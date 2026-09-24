import type {Project} from "@/sanity/lib/queries";

export const RECALL = {
  durationMs: 5500,
  silenceMs: 600,
  clearByMs: 4600,
  playSoloMs: 5100,
  writeSpeed: {
    fast: 1,
    mid: 1,
    slow: 1,
    snap: 1,
  },
  eraseSpeed: {
    fast: 1,
    mid: 1,
    slow: 1,
    snap: 1,
  },
  typePace: {
    fast: [30, 70],
    mid: [80, 140],
    slow: [150, 280],
    snap: [40, 50],
  },
  erasePace: {
    fast: [30, 60],
    mid: [80, 140],
    slow: [160, 300],
    snap: [40, 50],
  },
  holdDuration: {
    flash: 70,
    trace: 160,
    short: 360,
    pause: 260,
    meta: 1000,
    primary: 1160,
    long: 1260,
  },
  recallDelay: {
    soon: 260,
    mid: 520,
    late: 840,
  },
  overlapTiming: {
    tight: 200,
    mid: 420,
    loose: 760,
  },
  typeMsMin: 30,
  typeMsMax: 280,
  typePauseChance: 0,
  typePauseMin: 0,
  typePauseMax: 0,
  typeBurstChance: 0,
  typeBurstMs: 16,
  deleteMsMin: 30,
  deleteMsMax: 300,
  deletePauseChance: 0,
  deletePauseMin: 0,
  deletePauseMax: 0,
  deleteBurstChance: 0,
  deleteBurstMs: 16,
  sizes: {
    meta: 12,
    small: 14,
    medium: 28,
    large: 36,
    huge: 104,
    oversize: 118,
  },
  pink: "rgb(255, 96, 176)",
  core: "rgb(250, 252, 247)",
  green: "rgb(72, 210, 118)",
  pinkAlpha: 0.48,
  greenAlpha: 0.68,
  pinkDx: -1.5,
  pinkDy: -1,
  greenDx: 1.9,
  greenDy: 1.6,
  offsetJitter: 0.35,
  bloom: 0.18,
  bloomJitter: 0.06,
  edgeJitter: 0.06,
  gridStrength: 0.2,
  strokeEm: 0,
  greenExpand: 2,
  cellRatio: 0.85,
  pixelMeta: 1.08,
  pixelMedium: 1.28,
  pixelLarge: 1.38,
  pixelHuge: 1.48,
  cellMeta: 1.4,
  cellMedium: 1.7,
  cellLarge: 2,
  cellHuge: 2.4,
  bloomMeta: 0.1,
  bloomMedium: 0.14,
  bloomLarge: 0.18,
  bloomHuge: 0.24,
  bloomPxMeta: 0.8,
  bloomPxMedium: 1.2,
  bloomPxLarge: 1.6,
  bloomPxHuge: 2.2,
  offsetMeta: 0.9,
  offsetMedium: 1.15,
  offsetLarge: 1.45,
  offsetHuge: 1.9,
};

export const RECALL_PLAYBACK = "PLAYBACK";

export const RECALL_IDENTITY = [
  "KDH",
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
  "22—26",
  "SELECTED",
  "SELECTED WORKS",
  "MOVING IMAGE",
  "DESIGN",
  "MEDIA",
  "FILM",
  "WEB",
  "ARCHIVE",
  "PROJECT 01",
  "PROJECT 02",
] as const;

export const RECALL_SPOTS = {
  edge: {x: 5.5, y: 7.5},
  topRight: {x: 66, y: 13},
  midUp: {x: 34, y: 26},
  centerBig: {x: 22, y: 38},
  midLeft: {x: 9, y: 46},
  midRight: {x: 58, y: 57},
  lowLeft: {x: 8, y: 73},
  botRight: {x: 69, y: 78},
  lowRight: {x: 91, y: 73},
} as const;

export type RecallSpot = keyof typeof RECALL_SPOTS;
export type RecallMotion = "A" | "B" | "C" | "D";
export type RecallFace = "raster" | "display" | "meta";
export type RecallFrom = "year" | "title" | "category" | "slug" | "order";
export type RecallSpeed = keyof typeof RECALL.writeSpeed;

export const RECALL_TEMPO = {
  A: {write: "fast", erase: "slow", hold: RECALL.holdDuration.primary},
  B: {write: "slow", erase: "fast", hold: RECALL.holdDuration.short},
  C: {write: "fast", erase: "fast", hold: RECALL.holdDuration.long},
  D: {write: "slow", erase: "slow", hold: RECALL.holdDuration.meta},
  F: {write: "fast", erase: "fast", hold: RECALL.holdDuration.flash},
} as const;

export const RECALL_BEATS = {
  y22: 0,
  kdh: 70,
  p1: 180,
  cat: 1560,
  y22b: 2120,
  y24: 2180,
  sel: 2420,
  slug: 3760,
  span: 3980,
  play: 3080,
};

export type RecallOp =
  | {op: "type"; count?: number; speed?: RecallSpeed}
  | {op: "delete"; count?: number; speed?: RecallSpeed}
  | {op: "typeTo"; n: number; speed?: RecallSpeed}
  | {op: "deleteTo"; n: number; speed?: RecallSpeed}
  | {op: "hold"; ms: number};

export type RecallFrag = {
  id: string;
  text: string;
  from?: RecallFrom;
  fromIndex?: number;
  maxChars?: number;
  spot: RecallSpot;
  face: RecallFace;
  size: number;
  weight: number;
  track: number;
  opacity: number;
  motion: RecallMotion;
  start: number;
  endBy?: number;
  write?: RecallSpeed;
  erase?: RecallSpeed;
  anchor?: "left" | "right";
  fitMaxVw?: number;
  play: RecallOp[];
};

export const RECALL_FRAGS: RecallFrag[] = [
  {
    id: "y22",
    text: "2022",
    from: "year",
    fromIndex: 0,
    spot: "lowLeft",
    face: "display",
    size: RECALL.sizes.medium,
    weight: 500,
    track: 0.18,
    opacity: 0.88,
    motion: "B",
    start: RECALL_BEATS.y22,
    endBy: RECALL.clearByMs,
    write: RECALL_TEMPO.A.write,
    erase: RECALL_TEMPO.A.erase,
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL_TEMPO.A.hold},
      {op: "delete"},
    ],
  },
  {
    id: "kdh",
    text: "KDH",
    spot: "edge",
    face: "meta",
    size: RECALL.sizes.meta,
    weight: 500,
    track: 0.32,
    opacity: 0.46,
    motion: "A",
    start: RECALL_BEATS.kdh,
    endBy: RECALL.clearByMs,
    write: RECALL_TEMPO.F.write,
    erase: RECALL_TEMPO.F.erase,
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL_TEMPO.F.hold},
      {op: "delete"},
    ],
  },
  {
    id: "p1",
    text: "PROJECT 01",
    from: "title",
    fromIndex: 0,
    maxChars: 10,
    spot: "midUp",
    face: "display",
    size: RECALL.sizes.large,
    weight: 500,
    track: 0.05,
    opacity: 0.92,
    motion: "B",
    start: RECALL_BEATS.p1,
    endBy: RECALL.clearByMs,
    write: RECALL_TEMPO.B.write,
    erase: RECALL_TEMPO.B.erase,
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL_TEMPO.B.hold},
      {op: "delete"},
    ],
  },
  {
    id: "cat",
    text: "MOVING IMAGE",
    from: "category",
    fromIndex: 0,
    maxChars: 12,
    spot: "topRight",
    face: "meta",
    size: 20,
    weight: 400,
    track: 0.2,
    opacity: 0.78,
    motion: "B",
    start: RECALL_BEATS.cat,
    endBy: RECALL.clearByMs,
    write: RECALL_TEMPO.D.write,
    erase: RECALL_TEMPO.D.erase,
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL_TEMPO.D.hold},
      {op: "delete"},
    ],
  },
  {
    id: "y22b",
    text: "2022",
    from: "year",
    fromIndex: 0,
    spot: "lowLeft",
    face: "meta",
    size: RECALL.sizes.small,
    weight: 400,
    track: 0.26,
    opacity: 0.5,
    motion: "A",
    start: RECALL_BEATS.y22b,
    endBy: RECALL.clearByMs,
    write: RECALL_TEMPO.F.write,
    erase: RECALL_TEMPO.F.erase,
    play: [
      {op: "typeTo", n: 2},
      {op: "hold", ms: RECALL.holdDuration.flash},
      {op: "delete"},
    ],
  },
  {
    id: "y24",
    text: "2024",
    from: "year",
    fromIndex: 1,
    spot: "centerBig",
    face: "raster",
    size: RECALL.sizes.huge,
    weight: 500,
    track: -0.035,
    opacity: 0.94,
    motion: "C",
    start: RECALL_BEATS.y24,
    endBy: RECALL.clearByMs,
    write: RECALL_TEMPO.C.write,
    erase: RECALL_TEMPO.C.erase,
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL_TEMPO.C.hold},
      {op: "delete"},
    ],
  },
  {
    id: "play",
    text: RECALL_PLAYBACK,
    spot: "lowRight",
    face: "raster",
    size: RECALL.sizes.huge,
    weight: 500,
    track: 0.03,
    opacity: 0.94,
    motion: "B",
    anchor: "right",
    fitMaxVw: 45,
    start: RECALL_BEATS.play,
    write: "fast",
    erase: "snap",
    play: [
      {op: "typeTo", n: 4, speed: "fast"},
      {op: "hold", ms: 260},
      {op: "type", speed: "fast"},
      {op: "hold", ms: 1340},
      {op: "delete", speed: "snap"},
    ],
  },
  {
    id: "sel",
    text: "SELECTED",
    spot: "midRight",
    face: "display",
    size: RECALL.sizes.medium,
    weight: 500,
    track: 0.16,
    opacity: 0.72,
    motion: "D",
    start: RECALL_BEATS.sel,
    endBy: RECALL.clearByMs,
    write: "fast",
    erase: "fast",
    play: [
      {op: "typeTo", n: 3, speed: "fast"},
      {op: "hold", ms: 280},
      {op: "typeTo", n: 6, speed: "fast"},
      {op: "hold", ms: 240},
      {op: "type", speed: "mid"},
      {op: "hold", ms: 560},
      {op: "deleteTo", n: 4, speed: "fast"},
      {op: "hold", ms: 260},
      {op: "type", speed: "fast"},
      {op: "delete", speed: "fast"},
    ],
  },
  {
    id: "slug",
    text: "ARCHIVE",
    from: "slug",
    fromIndex: 0,
    maxChars: 8,
    spot: "midLeft",
    face: "meta",
    size: RECALL.sizes.meta,
    weight: 400,
    track: 0.24,
    opacity: 0.42,
    motion: "A",
    start: RECALL_BEATS.slug,
    endBy: RECALL.clearByMs,
    write: RECALL_TEMPO.F.write,
    erase: RECALL_TEMPO.F.erase,
    play: [
      {op: "typeTo", n: 4},
      {op: "hold", ms: RECALL.holdDuration.flash},
      {op: "delete"},
    ],
  },
  {
    id: "span",
    text: "22—26",
    spot: "lowLeft",
    face: "display",
    size: 22,
    weight: 400,
    track: 0.14,
    opacity: 0.76,
    motion: "A",
    start: RECALL_BEATS.span,
    endBy: RECALL.clearByMs,
    write: RECALL_TEMPO.F.write,
    erase: RECALL_TEMPO.F.erase,
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL.holdDuration.flash},
      {op: "delete"},
    ],
  },
];

export type RecallPool = {
  years: string[];
  titles: string[];
  categories: string[];
  slugs: string[];
  orders: string[];
};

export type RecallGlyph = {
  ch: string;
  face: RecallFace;
  size: number;
  sx: number;
  sy: number;
  dy: number;
  track: number;
  weight: number;
  pinkDx: number;
  pinkDy: number;
  greenDx: number;
  greenDy: number;
  bloom: number;
  seed: number;
};

export type RecallView = {
  id: string;
  key: string;
  text: string;
  glyphs: RecallGlyph[];
  anchor: "left" | "right";
  x: number;
  y: number;
  size: number;
  weight: number;
  track: number;
  opacity: number;
  trace: boolean;
  caret: boolean;
};

type TypeDir = "ltr" | "rtl";

type CompiledFrame = {
  at: number;
  until: number;
  a: number;
  b: number;
  cycle: number;
};

type CompiledFrag = {
  id: string;
  text: string;
  spot: RecallSpot;
  face: RecallFace;
  size: number;
  weight: number;
  track: number;
  opacity: number;
  anchor: "left" | "right";
  fitMaxVw?: number;
  frames: CompiledFrame[];
};

function hash32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unit(seed: string) {
  return (hash32(seed) % 10000) / 10000;
}

function motionDirs(motion: RecallMotion): {type: TypeDir; del: TypeDir; anchor: "left" | "right"} {
  if (motion === "A") {
    return {type: "ltr", del: "ltr", anchor: "left"};
  }
  if (motion === "B") {
    return {type: "ltr", del: "rtl", anchor: "left"};
  }
  if (motion === "C") {
    return {type: "rtl", del: "rtl", anchor: "right"};
  }
  return {type: "rtl", del: "ltr", anchor: "right"};
}

function stepMs(kind: "type" | "delete", seed: string, ch: string, speed: RecallSpeed) {
  const range = kind === "type" ? RECALL.typePace[speed] : RECALL.erasePace[speed];
  const u = unit(seed);
  if (ch === " ") {
    return Math.max(8, Math.round(range[0] * 0.4));
  }
  return Math.round(range[0] + u * (range[1] - range[0]));
}

function emptyRange(len: number, type: TypeDir): [number, number] {
  return type === "ltr" ? [0, 0] : [len, len];
}

function glyphLook(
  id: string,
  cycle: number,
  index: number,
  ch: string,
  frag: CompiledFrag,
): RecallGlyph {
  const s = hash32(`${id}:${cycle}:${index}:${ch}`);
  const u = (s % 10000) / 10000;
  const v = ((s >>> 8) % 10000) / 10000;
  const w = ((s >>> 16) % 10000) / 10000;
  const q = ((s >>> 20) % 10000) / 10000;
  const jitter = RECALL.offsetJitter;
  return {
    ch,
    face: frag.face,
    size: frag.size * (0.94 + u * 0.1),
    sx: 0.86 + u * 0.28,
    sy: 0.94 + v * 0.12,
    dy: (v - 0.5) * 0.14,
    track: frag.track + (w - 0.5) * 0.07,
    weight: Math.min(600, Math.max(400, frag.weight + (u < 0.3 ? 50 : u > 0.78 ? -50 : 0))),
    pinkDx: RECALL.pinkDx + (u - 0.5) * jitter,
    pinkDy: RECALL.pinkDy + (v - 0.5) * jitter,
    greenDx: RECALL.greenDx + (w - 0.5) * jitter,
    greenDy: RECALL.greenDy + (q - 0.5) * jitter,
    bloom: RECALL.bloom + (q - 0.5) * RECALL.bloomJitter,
    seed: s,
  };
}

export function buildRecallPool(projects: Project[]): RecallPool {
  const ordered = [...projects].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const years = [
    ...new Set(
      ordered
        .map((project) => project.year)
        .filter((year): year is number => typeof year === "number"),
    ),
  ]
    .sort((a, b) => a - b)
    .map(String);
  const titles = ordered
    .map((project, index) =>
      project.title?.trim() ||
      `PROJECT ${String(project.order ?? index + 1).padStart(2, "0")}`,
    )
    .filter(Boolean);
  const categories = [
    ...new Set(
      ordered
        .map((project) => project.category?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const slugs = ordered
    .map((project) => project.slug?.trim())
    .filter((value): value is string => Boolean(value));
  const orders = ordered
    .map((project, index) => String(project.order ?? index + 1).padStart(2, "0"));
  return {years, titles, categories, slugs, orders};
}

export function resolveRecallText(frag: RecallFrag, pool: RecallPool) {
  let text = frag.text;
  if (frag.from === "year" && pool.years[frag.fromIndex ?? 0]) {
    text = pool.years[frag.fromIndex ?? 0] ?? text;
  }
  if (frag.from === "title" && pool.titles[frag.fromIndex ?? 0]) {
    text = pool.titles[frag.fromIndex ?? 0] ?? text;
  }
  if (frag.from === "category" && pool.categories[frag.fromIndex ?? 0]) {
    text = pool.categories[frag.fromIndex ?? 0] ?? text;
  }
  if (frag.from === "slug" && pool.slugs[frag.fromIndex ?? 0]) {
    text = pool.slugs[frag.fromIndex ?? 0] ?? text;
  }
  if (frag.from === "order" && pool.orders[frag.fromIndex ?? 0]) {
    text = pool.orders[frag.fromIndex ?? 0] ?? text;
  }
  text = text.toUpperCase();
  if (frag.from === "title" && text.length > 12) {
    text = text.split(/\s+/)[0] ?? text.slice(0, 12);
  }
  if (frag.from === "category" && text.length > 8) {
    text = text.split(/\s+/)[0] ?? text.slice(0, 8);
  }
  if (frag.maxChars && text.length > frag.maxChars) {
    text = text.slice(0, frag.maxChars);
  }
  return text;
}

function compileFrag(frag: RecallFrag, text: string): CompiledFrag {
  const dirs = motionDirs(frag.motion);
  const {type, del} = dirs;
  const anchor = frag.anchor ?? dirs.anchor;
  const len = text.length;
  let [a, b] = emptyRange(len, type);
  let t = frag.start;
  let cycle = 0;
  const frames: CompiledFrame[] = [];

  const visible = () => b - a;
  const close = () => {
    const last = frames[frames.length - 1];
    if (last) {
      last.until = t;
    }
  };
  const push = () => {
    close();
    frames.push({at: t, until: RECALL.durationMs, a, b, cycle});
  };

  for (let opIndex = 0; opIndex < frag.play.length; opIndex += 1) {
    const step = frag.play[opIndex];
    if (step.op === "hold") {
      t += step.ms;
      continue;
    }

    const goal =
      step.op === "type"
        ? len
        : step.op === "delete"
          ? 0
          : step.op === "typeTo"
            ? Math.min(len, Math.max(0, step.n))
            : Math.min(len, Math.max(0, step.n));
    const writing = step.op === "type" || step.op === "typeTo";
    const writeSpeed = step.speed ?? frag.write ?? "mid";
    const eraseSpeed = step.speed ?? frag.erase ?? "mid";

    if (writing) {
      cycle += 1;
      if (visible() === 0) {
        [a, b] = emptyRange(len, type);
      }
    }

    let guard = 0;
    while (visible() !== goal && guard < 48) {
      guard += 1;
      if (writing) {
        if (visible() >= goal) {
          break;
        }
        const first = visible() === 0;
        if (type === "ltr") {
          if (b >= len) {
            break;
          }
          const ch = text[b] ?? "";
          if (!first) {
            t += stepMs("type", `${frag.id}:t:${opIndex}:${b}`, ch, writeSpeed);
          }
          b += 1;
        } else {
          if (a <= 0) {
            break;
          }
          const ch = text[a - 1] ?? "";
          if (!first) {
            t += stepMs("type", `${frag.id}:t:${opIndex}:${a}`, ch, writeSpeed);
          }
          a -= 1;
        }
        push();
        continue;
      }
      if (visible() <= goal) {
        break;
      }
      if (del === "ltr") {
        if (a >= b) {
          break;
        }
        const ch = text[a] ?? "";
        t += stepMs("delete", `${frag.id}:d:${opIndex}:${a}`, ch, eraseSpeed);
        a += 1;
      } else {
        if (b <= a) {
          break;
        }
        const ch = text[b - 1] ?? "";
        t += stepMs("delete", `${frag.id}:d:${opIndex}:${b}`, ch, eraseSpeed);
        b -= 1;
      }
      if (visible() > 0) {
        push();
      } else {
        close();
      }
    }
  }

  const endBy = Math.min(frag.endBy ?? RECALL.durationMs, RECALL.durationMs);
  if (frames.length) {
    for (const frame of frames) {
      frame.until = Math.min(frame.until, endBy);
    }
    while (frames.length && frames[frames.length - 1].at >= endBy) {
      frames.pop();
    }
  }

  return {
    id: frag.id,
    text,
    spot: frag.spot,
    face: frag.face,
    size: frag.size,
    weight: frag.weight,
    track: frag.track,
    opacity: frag.opacity,
    anchor,
    fitMaxVw: frag.fitMaxVw,
    frames,
  };
}

const compiledCache = new WeakMap<RecallPool, CompiledFrag[]>();

function compiledFor(pool: RecallPool) {
  const hit = compiledCache.get(pool);
  if (hit) {
    return hit;
  }
  const next = RECALL_FRAGS.map((frag) => compileFrag(frag, resolveRecallText(frag, pool)));
  compiledCache.set(pool, next);
  return next;
}

const fitCache = new Map<string, {vw: number; fitted: number}>();

function measureRecallWidth(text: string, size: number, track: number, face: RecallFace) {
  const fallback = text.length * size * (face === "raster" ? 0.48 : 0.56) + Math.max(0, text.length - 1) * track * size;
  if (typeof document === "undefined") {
    return fallback;
  }
  const host = document.querySelector(".crt-transit");
  const cs = host ? getComputedStyle(host) : getComputedStyle(document.documentElement);
  const cond = cs.getPropertyValue("--font-recall-cond").trim();
  const osw = cs.getPropertyValue("--font-recall-osw").trim();
  const stack =
    face === "display"
      ? osw || "Oswald, Impact, sans-serif"
      : cond || `"Barlow Condensed", "Arial Narrow", sans-serif`;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    return fallback;
  }
  ctx.font = `${face === "display" ? 500 : 600} ${size}px ${stack}`;
  let width = 0;
  for (let i = 0; i < text.length; i += 1) {
    width += ctx.measureText(text[i] ?? "").width;
    if (i < text.length - 1) {
      width += track * size;
    }
  }
  return width;
}

function fitRecallSize(frag: CompiledFrag, text: string) {
  if (!frag.fitMaxVw || typeof window === "undefined") {
    return frag.size;
  }
  const vw = window.innerWidth;
  const key = `${frag.id}:${text}:${frag.size}:${frag.track}:${frag.fitMaxVw}`;
  const hit = fitCache.get(key);
  if (hit && hit.vw === vw) {
    return hit.fitted;
  }
  const maxW = vw * (frag.fitMaxVw / 100);
  const width = measureRecallWidth(text, frag.size, frag.track, frag.face);
  const fitted = width <= maxW || width <= 1 ? frag.size : frag.size * (maxW / width);
  fitCache.set(key, {vw, fitted});
  return fitted;
}

function frameAt(frames: CompiledFrame[], ms: number) {
  let found: CompiledFrame | null = null;
  for (const frame of frames) {
    if (frame.at <= ms) {
      found = frame;
    } else {
      break;
    }
  }
  return found;
}

export function resolveRecall(ms: number, pool: RecallPool): RecallView[] {
  if (ms < 0 || ms >= RECALL.durationMs) {
    return [];
  }
  const views: RecallView[] = [];
  for (const frag of compiledFor(pool)) {
    const frame = frameAt(frag.frames, ms);
    if (!frame || ms >= frame.until || frame.b <= frame.a) {
      continue;
    }
    const slice = frag.text.slice(frame.a, frame.b);
    if (!slice) {
      continue;
    }
    const spot = RECALL_SPOTS[frag.spot];
    const size = fitRecallSize(frag, frag.text);
    const look = size === frag.size ? frag : {...frag, size};
    views.push({
      id: frag.id,
      key: `${frag.id}-${frame.cycle}-${frame.a}-${frame.b}-${size.toFixed(1)}`,
      text: slice,
      glyphs: Array.from(slice, (ch, i) =>
        glyphLook(frag.id, frame.cycle, frame.a + i, ch, look),
      ),
      anchor: frag.anchor,
      x: spot.x,
      y: spot.y,
      size,
      weight: frag.weight,
      track: frag.track,
      opacity: frag.opacity,
      trace: false,
      caret: frag.id === "play" && slice === frag.text,
    });
  }
  return views;
}

export function resolvePlaybackTrace(fade: number): RecallView[] {
  if (fade <= 0.02) {
    return [];
  }
  const src = RECALL_FRAGS.find((frag) => frag.id === "play");
  if (!src) {
    return [];
  }
  const text = RECALL_PLAYBACK;
  const compiled: CompiledFrag = {
    id: src.id,
    text,
    spot: src.spot,
    face: src.face,
    size: src.size,
    weight: src.weight,
    track: src.track,
    opacity: src.opacity,
    anchor: src.anchor ?? "right",
    fitMaxVw: src.fitMaxVw,
    frames: [],
  };
  const size = fitRecallSize(compiled, text);
  const look = size === compiled.size ? compiled : {...compiled, size};
  return [
    {
      id: src.id,
      key: `play-trace-${size.toFixed(1)}`,
      text,
      glyphs: Array.from(text, (ch, i) => glyphLook(src.id, 0, i, ch, look)),
      anchor: compiled.anchor,
      x: RECALL_SPOTS[src.spot].x,
      y: RECALL_SPOTS[src.spot].y,
      size,
      weight: src.weight,
      track: src.track,
      opacity: src.opacity * 0.36 * fade,
      trace: true,
      caret: false,
    },
  ];
}
