export type RecallPhase =
  | "idle"
  | "charge"
  | "hitch"
  | "rise"
  | "void"
  | "settle"
  | "reveal";

export type Flight = {
  delay: number;
  dur: number;
  rot: number;
  ease: string;
};

type Sample = {x: number; y: number; t: number};

const WINDOW_MS = 400;
const PATH_READY = 980;
const REVERSALS_READY = 4;
const MIN_SPAN = 300;

const EASES = [
  "cubic-bezier(0.55, 0.02, 0.82, 0.2)",
  "cubic-bezier(0.42, 0, 0.7, 0.12)",
  "cubic-bezier(0.68, 0.04, 0.9, 0.35)",
  "cubic-bezier(0.5, 0.08, 0.78, 0.18)",
];

export function pushSample(samples: Sample[], x: number, y: number, t: number) {
  samples.push({x, y, t});
  const cutoff = t - WINDOW_MS - 40;
  while (samples.length > 0 && samples[0]!.t < cutoff) {
    samples.shift();
  }
}

export function readShake(samples: Sample[], now: number) {
  const recent = samples.filter((sample) => now - sample.t <= WINDOW_MS);
  if (recent.length < 3) {
    return {power: 0, ready: false};
  }
  let path = 0;
  let reversals = 0;
  let prevX = 0;
  let prevY = 0;
  for (let i = 1; i < recent.length; i += 1) {
    const dx = recent[i]!.x - recent[i - 1]!.x;
    const dy = recent[i]!.y - recent[i - 1]!.y;
    path += Math.hypot(dx, dy);
    if (Math.abs(dx) > 12 && prevX !== 0 && Math.sign(dx) !== prevX) {
      reversals += 1;
    }
    if (Math.abs(dy) > 12 && prevY !== 0 && Math.sign(dy) !== prevY) {
      reversals += 1;
    }
    if (Math.abs(dx) > 12) {
      prevX = Math.sign(dx);
    }
    if (Math.abs(dy) > 12) {
      prevY = Math.sign(dy);
    }
  }
  const span = recent[recent.length - 1]!.t - recent[0]!.t;
  const pathU = Math.min(1, path / PATH_READY);
  const revU = Math.min(1, reversals / REVERSALS_READY);
  const power = pathU * (0.45 + 0.55 * revU);
  const ready =
    path >= PATH_READY && reversals >= REVERSALS_READY && span >= MIN_SPAN;
  return {power, ready};
}

function hashUnit(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function flightFor(
  id: string,
  w: number,
  h: number,
  role: "desk" | "stood" | "detail",
): Flight {
  const u = hashUnit(id);
  const u2 = hashUnit(`${id}:b`);
  const u3 = hashUnit(`${id}:c`);
  const area = Math.max(1, w * h);
  const base = Math.min(1, Math.max(0, (area - 22000) / 80000));
  const size = role === "detail" ? 1 : role === "stood" ? Math.max(base, 0.58) : base;
  const delay = Math.round(size * 420 + u * 140);
  const dur = Math.round(820 + size * 780 + u2 * 260);
  const sign = u3 < 0.5 ? -1 : 1;
  const rot = sign * (2.5 + (1 - size) * 12 + u2 * 5);
  const ease = EASES[Math.floor(u * EASES.length) % EASES.length] ?? EASES[0]!;
  return {delay, dur, rot, ease};
}

export function recallRush(phase: RecallPhase) {
  if (phase === "rise" || phase === "void") {
    return 1;
  }
  if (phase === "hitch") {
    return 0.4;
  }
  if (phase === "charge") {
    return 0.1;
  }
  return 0;
}
