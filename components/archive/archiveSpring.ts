import {ARCHIVE} from "@/components/archive/archiveConfig";

type Sample = {u: number; p: number};

function simulateSpring() {
  const {slideStiffness: k, slideDamping: c, slideMass: m} = ARCHIVE;
  const dt = 1 / 240;
  let x = 0;
  let v = 0;
  let t = 0;
  const pos: number[] = [0];
  const vel: number[] = [0];
  for (let i = 0; i < 4000; i += 1) {
    const a = (k * (1 - x) - c * v) / m;
    v += a * dt;
    x += v * dt;
    t += dt;
    pos.push(x);
    vel.push(v);
    if (t > 0.18 && Math.abs(x - 1) < 0.0015 && Math.abs(v) < 0.008) {
      break;
    }
  }
  pos[pos.length - 1] = 1;
  vel[vel.length - 1] = 0;
  return {pos, vel};
}

const sim = simulateSpring();

function resample(values: number[], count: number): Sample[] {
  const last = values.length - 1;
  return Array.from({length: count}, (_, i) => {
    const u = i / (count - 1);
    const at = u * last;
    const lo = Math.floor(at);
    const hi = Math.min(last, lo + 1);
    const t = at - lo;
    const p = (values[lo] ?? 0) * (1 - t) + (values[hi] ?? 0) * t;
    return {u, p};
  });
}

const easeSamples = resample(sim.pos, 25);
const velSamples = resample(sim.vel, 48);
const velPeak = velSamples.reduce((max, row) => Math.max(max, Math.abs(row.p)), 0.0001);

export const SLIDE_EASE = `linear(${easeSamples
  .map((row) => `${row.p.toFixed(4)} ${Math.round(row.u * 10000) / 100}%`)
  .join(", ")})`;

export function slideBlurAt(u: number) {
  const clamped = Math.min(1, Math.max(0, u));
  const last = velSamples.length - 1;
  const at = clamped * last;
  const lo = Math.floor(at);
  const hi = Math.min(last, lo + 1);
  const t = at - lo;
  const speed = Math.abs((velSamples[lo]?.p ?? 0) * (1 - t) + (velSamples[hi]?.p ?? 0) * t);
  return ARCHIVE.slideBlurMax * Math.min(1, speed / velPeak);
}
