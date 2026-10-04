import {CLOUD_RISE_SEC, readCloudRise, subscribeCloudRise} from "@/lib/cloudRise";
import {playPageTransitionGraph} from "@/lib/sound/pageTransitionSound";
import {bindSoundEngine, type EnterCue, type GhostTick, type MotionFrame} from "@/lib/sound/soundBus";

const VOICE_F = [220, 329.6, 440] as const;
const VOICE_PAN = [-0.45, 0, 0.45] as const;
const RADIO_STATIC_URL = "/sounds/airplane-cabin-loop.wav";
const RADIO_STATIC_GAIN = 0.15;
const RADIO_GAIN_FADE_SEC = 0.4;
const MUFFLED_URL = "/sounds/airplane-muffled.mp3";
// Cabin loop RMS is about -10.4 dBFS; this voice file is about -20.6 dBFS.
// Same bus level as the cabin bed at RADIO_STATIC_GAIN, so the first expand does not drop the volume.
const MUFFLED_GAIN = 0.48;
const WINDOW_FADE_SEC = 0.15;
// How much earlier the subpage bed starts, versus the window rise and the return from the first zoom.
// Edit this number only. Also skips that much of the file head (leading silence).
export const SOUND_LEAD_SEC = 0.15;

function cueOffset(buffer: AudioBuffer) {
  if (SOUND_LEAD_SEC <= 0) {
    return 0;
  }
  return Math.min(SOUND_LEAD_SEC, Math.max(0, buffer.duration - 0.05));
}

let radioStaticData: Promise<ArrayBuffer> | null = null;

function loadRadioStatic() {
  if (typeof window === "undefined") {
    return Promise.resolve(new ArrayBuffer(0));
  }
  if (!radioStaticData) {
    radioStaticData = fetch(RADIO_STATIC_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`radio static ${response.status}`);
      }
      return response.arrayBuffer();
    });
  }
  return radioStaticData;
}

if (typeof window !== "undefined") {
  loadRadioStatic();
}

let muffledData: Promise<ArrayBuffer> | null = null;

function loadMuffled() {
  if (typeof window === "undefined") {
    return Promise.resolve(new ArrayBuffer(0));
  }
  if (!muffledData) {
    muffledData = fetch(MUFFLED_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`muffled cabin ${response.status}`);
      }
      return response.arrayBuffer();
    });
  }
  return muffledData;
}

if (typeof window !== "undefined") {
  loadMuffled();
}

function ramp(param: AudioParam, value: number, tau: number, ctx: AudioContext) {
  const t = ctx.currentTime;
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.setTargetAtTime(value, t, Math.max(tau, 0.02));
}

function makeNoise(ctx: AudioContext, seconds: number, kind: "white" | "brown") {
  const count = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, count, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < count; i += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === "white") {
      data[i] = white;
    } else {
      last = (last + 0.02 * white) * 0.98;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}

function makeImpulse(ctx: AudioContext) {
  const duration = 4.5;
  const count = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, count, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < count; i += 1) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t / 2.8);
    }
  }
  return buffer;
}

type Voice = {
  base: number;
  a: OscillatorNode;
  b: OscillatorNode;
  aSine: OscillatorNode;
  bSine: OscillatorNode;
  gain: GainNode;
  pan: StereoPannerNode;
  mult: number;
  nextMult: number;
  nextMultAt: number;
};

export class SoundEngine {
  private static instance: SoundEngine | null = null;

  static get() {
    if (!SoundEngine.instance) {
      SoundEngine.instance = new SoundEngine();
    }
    return SoundEngine.instance;
  }

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private bus: GainNode | null = null;
  private conv: ConvolverNode | null = null;
  private masterPan: StereoPannerNode | null = null;
  private brownGain: GainNode | null = null;
  private brownFilter: BiquadFilterNode | null = null;
  private moireFilter: BiquadFilterNode | null = null;
  private hissGain: GainNode | null = null;
  private hissFilter: BiquadFilterNode | null = null;
  private humGain: GainNode | null = null;
  private mainBed: GainNode | null = null;
  private archiveBed: GainNode | null = null;
  private radioBuffer: AudioBuffer | null = null;
  private radioStatic: AudioBufferSourceNode | null = null;
  private radioGain: GainNode | null = null;
  private radioRestGain = RADIO_STATIC_GAIN;
  private radioLive = false;
  private radioFadeRaf = 0;
  private radioFadeUnsub: (() => void) | null = null;
  private cabinFilter: BiquadFilterNode | null = null;
  private muffledBuffer: AudioBuffer | null = null;
  private muffled: AudioBufferSourceNode | null = null;
  private muffledGain: GainNode | null = null;
  private muffledToken = 0;
  private muffleWanted = false;
  private windowPhase: "bed" | "muffle" | "picture" = "bed";
  private onHearMute: ((muted: boolean) => void) | null = null;
  private ambient: "main" | "archive" = "main";
  private whistle: OscillatorNode | null = null;
  private whistleGain: GainNode | null = null;
  private voices: Voice[] = [];
  private started = false;
  private startTask: Promise<void> | null = null;
  private muted = false;
  private moving = false;
  private stopAt = 0;
  private hold = false;
  private nextWander = 0;
  private lastEnergy = 0;
  private lastVoiceGain = 0;
  private degaussUntil = 0;
  private roomWet = 0.04;

  get isStarted() {
    return this.started;
  }

  get isMuted() {
    return this.muted;
  }

  async start() {
    if (this.started && this.ctx) {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      return;
    }
    if (!this.startTask) {
      this.startTask = this.openContext();
    }
    try {
      await this.startTask;
    } catch (error) {
      this.startTask = null;
      throw error;
    }
  }

  private async openContext() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 10;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.18;

    const master = ctx.createGain();
    master.gain.value = 0.6;
    const masterPan = ctx.createStereoPanner();
    masterPan.pan.value = 0;

    compressor.connect(master);
    master.connect(ctx.destination);

    const bus = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.gain.value = 0.96;
    wet.gain.value = 0.04;
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx);
    bus.connect(dry);
    bus.connect(conv);
    conv.connect(wet);
    dry.connect(masterPan);
    wet.connect(masterPan);
    masterPan.connect(compressor);

    const onArchive = document.body.classList.contains("is-archive");
    const mainBed = ctx.createGain();
    const archiveBed = ctx.createGain();
    mainBed.gain.value = onArchive ? 0 : 1;
    archiveBed.gain.value = onArchive ? 1 : 0;
    mainBed.connect(bus);
    const cabinFilter = ctx.createBiquadFilter();
    cabinFilter.type = "lowpass";
    cabinFilter.frequency.value = 20000;
    cabinFilter.Q.value = 0.7;
    cabinFilter.connect(archiveBed);
    archiveBed.connect(bus);

    const brown = ctx.createBufferSource();
    brown.buffer = makeNoise(ctx, 2.4, "brown");
    brown.loop = true;
    const brownFilter = ctx.createBiquadFilter();
    brownFilter.type = "lowpass";
    brownFilter.frequency.value = 380;
    brownFilter.Q.value = 0.65;
    const brownGain = ctx.createGain();
    brownGain.gain.value = 0.035;
    brown.connect(brownFilter);
    brownFilter.connect(brownGain);
    brownGain.connect(mainBed);
    brown.start();

    const humGain = ctx.createGain();
    humGain.gain.value = 1;
    humGain.connect(mainBed);
    [
      [60, 0.01],
      [120, 0.005],
      [180, 0.0025],
    ].forEach(([freq, gain]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(humGain);
      osc.start();
    });

    const moireFilter = ctx.createBiquadFilter();
    moireFilter.type = "lowpass";
    moireFilter.frequency.value = 380;
    moireFilter.Q.value = 0.7;
    moireFilter.connect(mainBed);

    const voices: Voice[] = VOICE_F.map((base, index) => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      pan.pan.value = VOICE_PAN[index] ?? 0;
      gain.connect(pan);
      pan.connect(moireFilter);

      const a = ctx.createOscillator();
      a.type = "triangle";
      a.frequency.value = base;
      const aSine = ctx.createOscillator();
      aSine.type = "sine";
      aSine.frequency.value = base;
      const aMix = ctx.createGain();
      aMix.gain.value = 0.22;
      a.connect(gain);
      aSine.connect(aMix);
      aMix.connect(gain);

      const b = ctx.createOscillator();
      b.type = "triangle";
      b.frequency.value = base;
      const bSine = ctx.createOscillator();
      bSine.type = "sine";
      bSine.frequency.value = base;
      const bMix = ctx.createGain();
      bMix.gain.value = 0.18;
      b.connect(gain);
      bSine.connect(bMix);
      bMix.connect(gain);

      a.start();
      aSine.start();
      b.start();
      bSine.start();

      return {
        base,
        a,
        b,
        aSine,
        bSine,
        gain,
        pan,
        mult: 0.7 + Math.random() * 0.7,
        nextMult: 1,
        nextMultAt: ctx.currentTime + 10 + Math.random() * 10,
      };
    });

    const hiss = ctx.createBufferSource();
    hiss.buffer = makeNoise(ctx, 1.6, "white");
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = "bandpass";
    hissFilter.frequency.value = 3000;
    hissFilter.Q.value = 0.8;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(mainBed);
    hiss.start();

    if (onArchive) {
      void this.prepareRadioStatic(ctx);
      void this.prepareMuffled(ctx);
    }

    const whistle = ctx.createOscillator();
    whistle.type = "sine";
    whistle.frequency.value = 8000;
    const whistleGain = ctx.createGain();
    whistleGain.gain.value = 0;
    whistle.connect(whistleGain);
    whistleGain.connect(bus);
    whistle.start();

    this.master = master;
    this.compressor = compressor;
    this.dry = dry;
    this.wet = wet;
    this.bus = bus;
    this.conv = conv;
    this.masterPan = masterPan;
    this.brownGain = brownGain;
    this.brownFilter = brownFilter;
    this.moireFilter = moireFilter;
    this.hissGain = hissGain;
    this.hissFilter = hissFilter;
    this.humGain = humGain;
    this.mainBed = mainBed;
    this.archiveBed = archiveBed;
    this.cabinFilter = cabinFilter;
    this.ambient = onArchive ? "archive" : "main";
    this.whistle = whistle;
    this.whistleGain = whistleGain;
    this.voices = voices;
    this.started = true;
    this.nextWander = ctx.currentTime + 8;
    this.stopAt = 0;
    this.moving = false;
    this.roomWet = 0.04;
    this.degaussUntil = 0;

    bindSoundEngine(this);
    this.playPowerOn();
  }

  private async prepareRadioStatic(ctx: AudioContext) {
    try {
      const raw = await loadRadioStatic();
      if (this.ctx !== ctx || this.radioBuffer || raw.byteLength < 16) {
        return;
      }
      const buffer = await ctx.decodeAudioData(raw.slice(0));
      if (this.ctx !== ctx || this.radioBuffer) {
        return;
      }
      this.radioBuffer = buffer;
      if (this.ambient === "archive" && this.windowPhase === "bed") {
        this.startRadioStatic();
      }
    } catch {
      this.radioBuffer = null;
    }
  }

  private rampRadioGain(value: number, seconds: number) {
    if (!this.ctx || !this.radioGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const param = this.radioGain.gain;
    const from = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(from, now);
    if (seconds > 0) {
      param.linearRampToValueAtTime(value, now + seconds);
      return;
    }
    param.setValueAtTime(value, now);
  }

  private startRadioStatic() {
    if (!this.ctx || !this.archiveBed || !this.radioBuffer) {
      return;
    }
    if (this.radioStatic) {
      this.stopRadioFade();
      this.radioLive = true;
      this.rampRadioGain(this.radioRestGain, RADIO_GAIN_FADE_SEC);
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.radioBuffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.cabinFilter ?? this.archiveBed);
    source.start(this.ctx.currentTime, cueOffset(this.radioBuffer));
    this.radioStatic = source;
    this.radioGain = gain;
    this.radioLive = true;
    this.fadeRadioIn(gain);
    if (this.cabinFilter) {
      const open = this.ctx.currentTime;
      this.cabinFilter.frequency.cancelScheduledValues(open);
      this.cabinFilter.frequency.setValueAtTime(20000, open);
    }
    const now = this.ctx.currentTime;
    this.archiveBed.gain.cancelScheduledValues(now);
    this.archiveBed.gain.setValueAtTime(1, now);
  }

  private stopRadioFade() {
    if (this.radioFadeRaf) {
      cancelAnimationFrame(this.radioFadeRaf);
      this.radioFadeRaf = 0;
    }
    this.radioFadeUnsub?.();
    this.radioFadeUnsub = null;
  }

  private applyRadioRise(gain: GainNode, progress: number) {
    if (this.radioGain !== gain) {
      return;
    }
    const led =
      SOUND_LEAD_SEC > 0 ? Math.min(1, progress + SOUND_LEAD_SEC / CLOUD_RISE_SEC) : progress;
    const p = Math.min(1, Math.max(0, led));
    gain.gain.value = RADIO_STATIC_GAIN * p * p;
  }

  private fadeRadioIn(gain: GainNode) {
    this.stopRadioFade();
    gain.gain.value = 0;
    if (readCloudRise() < 1) {
      this.radioFadeUnsub = subscribeCloudRise((progress) => {
        this.applyRadioRise(gain, progress);
        if (progress >= 1) {
          this.radioFadeUnsub?.();
          this.radioFadeUnsub = null;
        }
      });
      return;
    }
    const started = performance.now();
    const step = () => {
      const progress = Math.min(1, (performance.now() - started) / (CLOUD_RISE_SEC * 1000));
      this.applyRadioRise(gain, progress);
      if (progress < 1 && this.radioGain === gain) {
        this.radioFadeRaf = requestAnimationFrame(step);
      } else {
        this.radioFadeRaf = 0;
      }
    };
    this.radioFadeRaf = requestAnimationFrame(step);
  }

  private stopRadioStatic(fadeSec = 0) {
    this.stopRadioFade();
    if (this.radioGain && this.radioLive) {
      const level = this.radioGain.gain.value;
      if (level > 0.0001) {
        this.radioRestGain = level;
      }
    }
    this.radioLive = false;
    this.rampRadioGain(0, fadeSec);
  }

  private async prepareMuffled(ctx: AudioContext) {
    try {
      const raw = await loadMuffled();
      if (this.ctx !== ctx || this.muffledBuffer || raw.byteLength < 16) {
        return;
      }
      const buffer = await ctx.decodeAudioData(raw.slice(0));
      if (this.ctx !== ctx || this.muffledBuffer) {
        return;
      }
      this.muffledBuffer = buffer;
      if (this.muffleWanted && this.windowPhase !== "bed") {
        this.startMuffled(0);
      }
    } catch {
      this.muffledBuffer = null;
    }
  }

  private startMuffled(fadeSec: number) {
    this.muffleWanted = true;
    if (!this.ctx || !this.bus || !this.muffledBuffer) {
      return;
    }
    this.muffleWanted = false;
    if (this.muffled && this.muffledGain) {
      this.muffledToken += 1;
      const now = this.ctx.currentTime;
      const current = this.muffledGain.gain.value;
      this.muffledGain.gain.cancelScheduledValues(now);
      const lead = fadeSec > 0 ? Math.min(Math.max(0, SOUND_LEAD_SEC), fadeSec) : 0;
      const from =
        fadeSec > 0 ? Math.max(current, MUFFLED_GAIN * (lead / fadeSec)) : MUFFLED_GAIN;
      this.muffledGain.gain.setValueAtTime(Math.max(0.0001, from), now);
      if (fadeSec > lead && from < MUFFLED_GAIN * 0.9) {
        this.muffledGain.gain.linearRampToValueAtTime(MUFFLED_GAIN, now + (fadeSec - lead));
      } else {
        this.muffledGain.gain.setValueAtTime(MUFFLED_GAIN, now);
      }
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.muffledBuffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const lead = fadeSec > 0 ? Math.min(Math.max(0, SOUND_LEAD_SEC), fadeSec) : 0;
    const from = fadeSec > 0 ? Math.max(0.0001, MUFFLED_GAIN * (lead / fadeSec)) : MUFFLED_GAIN;
    gain.gain.setValueAtTime(from, now);
    if (fadeSec > lead) {
      gain.gain.linearRampToValueAtTime(MUFFLED_GAIN, now + (fadeSec - lead));
    }
    source.connect(gain);
    gain.connect(this.bus);
    source.start(now, fadeSec > 0 ? cueOffset(this.muffledBuffer) : 0);
    this.muffled = source;
    this.muffledGain = gain;
  }

  private stopMuffled(fadeSec: number) {
    const source = this.muffled;
    const gain = this.muffledGain;
    this.muffleWanted = false;
    if (!source || !gain || !this.ctx) {
      this.muffled = null;
      this.muffledGain = null;
      return;
    }
    const token = ++this.muffledToken;
    if (fadeSec <= 0) {
      this.muffled = null;
      this.muffledGain = null;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      gain.disconnect();
      return;
    }
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    window.setTimeout(() => {
      if (token !== this.muffledToken || this.muffled !== source) {
        return;
      }
      this.muffled = null;
      this.muffledGain = null;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      gain.disconnect();
    }, Math.round(fadeSec * 1000) + 40);
  }

  setAmbient(mode: "main" | "archive") {
    if (!this.ctx || !this.mainBed || !this.archiveBed || !this.started) {
      return;
    }
    if (mode === this.ambient) {
      return;
    }
    this.ambient = mode;
    if (mode === "archive") {
      this.fadeBed(this.mainBed, 0, 0.1);
      void this.prepareRadioStatic(this.ctx);
      void this.prepareMuffled(this.ctx);
      if (this.windowPhase === "bed") {
        this.startRadioStatic();
      }
      return;
    }
    this.stopMuffled(0);
    this.windowPhase = "bed";
    this.stopRadioStatic(0);
    this.fadeBed(this.mainBed, 1, 0.1);
  }

  beginWindowExpand() {
    if (!this.started) {
      return;
    }
    this.windowPhase = "muffle";
    this.stopRadioStatic(RADIO_GAIN_FADE_SEC);
    this.startMuffled(0);
  }

  finishWindowExpand() {
    if (this.windowPhase === "bed") {
      return;
    }
    this.windowPhase = "picture";
    this.stopMuffled(WINDOW_FADE_SEC);
  }

  pauseArchiveBed() {
    this.windowPhase = "picture";
    this.stopRadioStatic(RADIO_GAIN_FADE_SEC);
    this.stopMuffled(0);
  }

  beginWindowShrink() {
    if (!this.started || this.windowPhase === "bed") {
      return;
    }
    this.windowPhase = "muffle";
    this.startMuffled(WINDOW_FADE_SEC);
  }

  finishWindowShrink() {
    this.stopMuffled(0);
    this.windowPhase = "bed";
    if (this.ambient === "archive") {
      this.startRadioStatic();
    }
  }

  private fadeBed(node: GainNode, value: number, seconds: number) {
    if (!this.ctx) {
      return;
    }
    const t = this.ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(value, t + seconds);
  }

  bindHearMute(fn: (muted: boolean) => void) {
    this.onHearMute = fn;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.onHearMute?.(muted);
    if (!this.ctx || !this.master) {
      return;
    }
    ramp(this.master.gain, muted ? 0 : 0.6, 0.08, this.ctx);
  }

  setMotion(frame: MotionFrame) {
    if (!this.ctx || !this.started) {
      return;
    }
    const ctx = this.ctx;
    const energy = Math.min(1, Math.max(0, frame.energy));
    this.lastEnergy = energy;
    const now = ctx.currentTime;
    const x = Math.min(1, Math.max(0, frame.x));
    const y = Math.min(1, Math.max(0, frame.y));
    const speed = Math.min(1, Math.max(0, frame.speed));
    const dist = Math.hypot(x - 0.5, y - 0.5) / 0.707;

    if (energy > 0.03) {
      this.moving = true;
      this.stopAt = 0;
    } else if (this.moving) {
      this.moving = false;
      this.stopAt = now;
    }

    const stopping = !this.moving && !this.hold && this.stopAt > 0;
    const stopAge = this.stopAt > 0 ? now - this.stopAt : 99;

    this.voices.forEach((voice) => {
      if (now >= voice.nextMultAt) {
        voice.mult = voice.nextMult;
        voice.nextMult = 0.7 + Math.random() * 0.7;
        voice.nextMultAt = now + 10 + Math.random() * 10;
      }
      const drift = voice.mult + (voice.nextMult - voice.mult) * 0.08;
      const delta = this.hold || stopping || !this.moving ? 0 : energy * 5 * drift;
      const tau = stopping || this.hold ? 0.6 : 0.18;
      ramp(voice.b.frequency, voice.base + delta, tau, ctx);
      ramp(voice.bSine.frequency, voice.base + delta, tau, ctx);

      let gain = 0;
      if (this.hold) {
        gain = 0.12;
      } else if (this.moving) {
        this.lastVoiceGain = energy ** 1.3 * 0.06;
        gain = this.lastVoiceGain;
      } else if (this.stopAt > 0) {
        if (stopAge < 2) {
          gain = this.lastVoiceGain * (1 - stopAge * 0.12);
        } else {
          gain = this.lastVoiceGain * Math.max(0, 1 - (stopAge - 2) / 3);
        }
      }
      ramp(voice.gain.gain, gain, this.hold ? 0.12 : stopping ? 0.85 : 0.1, ctx);
    });

    const open = this.hold ? 1 : energy;
    const lpf = 380 * Math.pow(5000 / 380, open);
    const distCut = 1 - dist * (0.2 + 0.2 * energy);
    ramp(this.moireFilter!.frequency, lpf * distCut, 0.12, ctx);
    ramp(this.brownFilter!.frequency, lpf * distCut, 0.16, ctx);

    ramp(this.hissGain!.gain, speed ** 1.5 * 0.04, speed > 0.02 ? 0.06 : 0.133, ctx);
    ramp(this.humGain!.gain, 1 - energy * 0.72, 0.2, ctx);
    if (now >= this.degaussUntil) {
      const wet = this.hold ? 0.45 : this.roomWet + energy * 0.26;
      ramp(this.wet!.gain, Math.min(0.9, wet), 0.18, ctx);
      ramp(this.dry!.gain, 1 - Math.min(0.9, wet) * 0.35, 0.18, ctx);
    }
    ramp(this.masterPan!.pan, (x * 2 - 1) * 0.6 * energy, 0.12, ctx);

    if (now >= this.nextWander && this.brownGain) {
      const next = 0.035 * (0.9 + Math.random() * 0.2);
      ramp(this.brownGain.gain, next, 2.8, ctx);
      this.nextWander = now + 8 + Math.random() * 7;
    }
  }

  ghostTick(tick: GhostTick) {
    if (!this.ctx || !this.bus || this.muted) {
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const size = Math.min(16, Math.max(9, tick.size));
    const dur = 0.015 + ((16 - size) / 7) * 0.008 + ((size - 9) / 7) * 0.012;
    const freq = 5000 - ((size - 9) / 7) * 3000;
    const src = ctx.createBufferSource();
    src.buffer = makeNoise(ctx, 0.08, "white");
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2000 + Math.random() * 3000;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.setTargetAtTime(0.025, t, 0.008);
    gain.gain.setTargetAtTime(0.0001, t + dur, 0.02);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.min(1, Math.max(-1, tick.x * 2 - 1));
    src.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.bus);
    src.start(t);
    src.stop(t + 0.08);
  }

  enter(cue: EnterCue) {
    if (!this.ctx || !this.started) {
      return;
    }
    if (cue === "hold") {
      this.hold = true;
      this.setMotion({
        energy: Math.max(this.lastEnergy, 0.35),
        x: 0.5,
        y: 0.5,
        speed: 0,
      });
      return;
    }
    if (cue === "cancel") {
      this.hold = false;
      this.setMotion({
        energy: this.lastEnergy,
        x: 0.5,
        y: 0.5,
        speed: 0,
      });
      return;
    }
    if (cue === "flash") {
      this.hold = true;
      this.playDegauss();
      this.setMotion({
        energy: 1,
        x: 0.5,
        y: 0.5,
        speed: 0,
      });
      return;
    }
    this.hold = false;
    this.degaussUntil = 0;
    this.roomWet = 0.1;
    if (this.wet && this.dry && this.ctx) {
      ramp(this.wet.gain, 0.1, 0.7, this.ctx);
      ramp(this.dry.gain, 0.965, 0.7, this.ctx);
    }
  }

  cueOutput() {
    if (!this.ctx || !this.bus || !this.started || this.muted) {
      return null;
    }
    return {ctx: this.ctx, destination: this.bus};
  }

  playPageTransition(frequency: number) {
    if (!this.ctx || !this.bus || !this.started || this.muted) {
      return;
    }
    if (!Number.isFinite(frequency) || frequency <= 0) {
      return;
    }
    playPageTransitionGraph(this.ctx, this.bus, frequency);
  }

  private playPowerOn() {
    if (!this.ctx || !this.bus || !this.whistle || !this.whistleGain) {
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.value = 60;
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.22, t);
    thumpGain.gain.setTargetAtTime(0.0001, t, 0.12);
    thump.connect(thumpGain);
    thumpGain.connect(this.bus);
    thump.start(t);
    thump.stop(t + 0.5);

    const burst = ctx.createBufferSource();
    burst.buffer = makeNoise(ctx, 0.2, "white");
    const hipass = ctx.createBiquadFilter();
    hipass.type = "highpass";
    hipass.frequency.value = 2400;
    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(0.07, t);
    burstGain.gain.setTargetAtTime(0.0001, t, 0.045);
    burst.connect(hipass);
    hipass.connect(burstGain);
    burstGain.connect(this.bus);
    burst.start(t);
    burst.stop(t + 0.18);

    this.whistle.frequency.setValueAtTime(8000, t);
    this.whistle.frequency.exponentialRampToValueAtTime(15700, t + 1);
    this.whistleGain.gain.setValueAtTime(0.0001, t);
    this.whistleGain.gain.setTargetAtTime(0.0015, t, 0.12);
  }

  private playDegauss() {
    if (!this.ctx || !this.bus || !this.wet) {
      return;
    }
    const ctx = this.ctx;
    const bus = this.bus;
    const t = ctx.currentTime;

    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.value = 55;
    const am = ctx.createGain();
    am.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 12;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.14;
    lfo.connect(lfoDepth);
    lfoDepth.connect(am.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.18, t);
    env.gain.setTargetAtTime(0.0001, t, 0.28);
    carrier.connect(am);
    am.connect(env);
    env.connect(bus);
    carrier.start(t);
    lfo.start(t);
    carrier.stop(t + 1.1);
    lfo.stop(t + 1.1);

    [1200, 1830].forEach((freq, i) => {
      const ring = ctx.createOscillator();
      ring.type = "sine";
      ring.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.04 - i * 0.01, t);
      g.gain.setTargetAtTime(0.0001, t, 0.09 + i * 0.03);
      ring.connect(g);
      g.connect(bus);
      ring.start(t);
      ring.stop(t + 0.5);
    });

    this.degaussUntil = t + 1.2;
    ramp(this.wet.gain, 0.9, 0.05, ctx);
    if (this.dry) {
      ramp(this.dry.gain, 0.685, 0.05, ctx);
    }
  }
}
