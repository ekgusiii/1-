import {bindSoundEngine, type EnterCue, type GhostTick, type MotionFrame} from "@/lib/sound/soundBus";

const VOICE_F = [220, 329.6, 440] as const;
const VOICE_PAN = [-0.45, 0, 0.45] as const;

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
  private whistle: OscillatorNode | null = null;
  private whistleGain: GainNode | null = null;
  private voices: Voice[] = [];
  private started = false;
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
    brownGain.connect(bus);
    brown.start();

    const humGain = ctx.createGain();
    humGain.gain.value = 1;
    humGain.connect(bus);
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
    moireFilter.connect(bus);

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
    hissGain.connect(bus);
    hiss.start();

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

  setMuted(muted: boolean) {
    this.muted = muted;
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
