import {
  PAGE_TRANSITION_ATTACK,
  PAGE_TRANSITION_DURATION,
  PAGE_TRANSITION_MASTER_GAIN,
  PAGE_TRANSITION_RELEASE,
} from "@/lib/sound/pageFrequencies";

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const count = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, count, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < count; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function playPageTransitionGraph(
  ctx: AudioContext,
  destination: AudioNode,
  frequency: number,
) {
  const toneHz = Math.max(40, frequency);
  const t = ctx.currentTime;
  const attack = PAGE_TRANSITION_ATTACK;
  const release = PAGE_TRANSITION_RELEASE;
  const duration = Math.max(PAGE_TRANSITION_DURATION, attack + release);

  const master = ctx.createGain();
  master.gain.value = PAGE_TRANSITION_MASTER_GAIN;
  master.connect(destination);

  const tone = ctx.createOscillator();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(toneHz, t);
  const toneGain = ctx.createGain();
  toneGain.gain.setValueAtTime(0.0001, t);
  toneGain.gain.linearRampToValueAtTime(0.85, t + attack);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  tone.connect(toneGain);
  toneGain.connect(master);
  tone.start(t);
  tone.stop(t + duration + 0.05);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.2);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(toneHz, t);
  filter.Q.value = 6;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.linearRampToValueAtTime(0.28, t + attack);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + attack + 0.12);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(t);
  noise.stop(t + 0.2);

  window.setTimeout(() => {
    tone.disconnect();
    toneGain.disconnect();
    noise.disconnect();
    filter.disconnect();
    noiseGain.disconnect();
    master.disconnect();
  }, (duration + 0.2) * 1000);
}
