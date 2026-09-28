import {SoundEngine} from "@/lib/sound/SoundEngine";

const TYPEWRITER_URL = "/sounds/typewriter-loop.wav";
const KEY_GAIN = 0.22;
const KEY_GAP_SEC = 0.04;
const REVEAL_OFFSET = 0.13;
const REVEAL_DUR = 0.08;
const DISMISS_OFFSET = 0.52;
const DISMISS_DUR = 0.07;

export type KeystrokeMode = "reveal" | "dismiss";

let typewriterData: Promise<ArrayBuffer> | null = null;
let typewriterBuffer: AudioBuffer | null = null;
let lastKeyAt = -1;
const live: AudioBufferSourceNode[] = [];

export function preloadTypewriter() {
  if (typeof window === "undefined") {
    return Promise.resolve(new ArrayBuffer(0));
  }
  if (!typewriterData) {
    typewriterData = fetch(TYPEWRITER_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`typewriter ${response.status}`);
      }
      return response.arrayBuffer();
    });
  }
  return typewriterData;
}

if (typeof window !== "undefined") {
  preloadTypewriter();
}

async function bufferFor(ctx: AudioContext) {
  if (typewriterBuffer) {
    return typewriterBuffer;
  }
  const raw = await preloadTypewriter();
  if (raw.byteLength < 16) {
    throw new Error("typewriter empty");
  }
  const decoded = await ctx.decodeAudioData(raw.slice(0));
  typewriterBuffer = decoded;
  return decoded;
}

export function warmTypewriter() {
  const out = SoundEngine.get().cueOutput();
  if (!out || typewriterBuffer) {
    return;
  }
  void bufferFor(out.ctx).catch(() => {
    typewriterBuffer = null;
  });
}

export function stopKeystrokeSound() {
  lastKeyAt = -1;
  const nodes = live.splice(0, live.length);
  for (const source of nodes) {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
    source.disconnect();
  }
}

export function playKeystrokeSound(mode: KeystrokeMode = "reveal") {
  const out = SoundEngine.get().cueOutput();
  if (!out || !typewriterBuffer) {
    if (out) {
      void bufferFor(out.ctx).catch(() => {
        typewriterBuffer = null;
      });
    }
    return false;
  }
  const now = out.ctx.currentTime;
  if (now - lastKeyAt < KEY_GAP_SEC) {
    return false;
  }
  const buffer = typewriterBuffer;
  const reveal = mode === "reveal";
  const offset = reveal ? REVEAL_OFFSET : DISMISS_OFFSET;
  const duration = reveal ? REVEAL_DUR : DISMISS_DUR;
  if (offset + duration > buffer.duration) {
    return false;
  }
  const source = out.ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = false;
  source.playbackRate.value = (reveal ? 1 : 0.94) + (Math.random() * 0.1 - 0.05);
  const gain = out.ctx.createGain();
  gain.gain.value = KEY_GAIN;
  source.connect(gain);
  gain.connect(out.destination);
  const at = out.ctx.currentTime;
  lastKeyAt = at;
  source.start(at, offset, duration);
  live.push(source);
  source.onended = () => {
    const index = live.indexOf(source);
    if (index >= 0) {
      live.splice(index, 1);
    }
    source.disconnect();
    gain.disconnect();
  };
  return true;
}
