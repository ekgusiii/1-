import type {Project} from "@/sanity/lib/queries";
import {
  RECALL_RETRO,
  retroAppearLook,
  retroAppearMs,
  retroCursorOn,
  retroExtraBlinks,
  retroGhostLook,
  retroGhostMs,
  retroMarkAlpha,
  retroTrackFor,
  retroUnit,
} from "@/components/crt/crtRecallRetro";

export const RECALL = {
  durationMs: 5000,
  silenceMs: 260,
  writeSpeed: {
    fast: 1,
    mid: 1,
    slow: 1,
  },
  eraseSpeed: {
    fast: 1,
    mid: 1,
    slow: 1,
  },
  writeMs: {
    fast: [30, 70],
    mid: [80, 140],
    slow: [150, 280],
  },
  eraseMs: {
    fast: [30, 60],
    mid: [80, 140],
    slow: [160, 300],
  },
  holdDuration: {
    flash: 70,
    trace: 160,
    short: 300,
    pause: 320,
    meta: 900,
    primary: 1050,
    long: 1180,
  },
  recallDelay: {
    soon: 2280,
    mid: 2460,
    late: 2880,
    slug: 3680,
    span: 4220,
  },
  overlapTiming: {
    tight: 90,
    mid: 420,
    loose: 1520,
  },
  typeMsMin: 30,
  typeMsMax: 70,
  typePauseChance: 0,
  typePauseMin: 0,
  typePauseMax: 0,
  typeBurstChance: 0,
  typeBurstMs: 16,
  deleteMsMin: 30,
  deleteMsMax: 60,
  deletePauseChance: 0,
  deletePauseMin: 0,
  deletePauseMax: 0,
  deleteBurstChance: 0,
  deleteBurstMs: 16,
  sizes: {
    meta: 12,
    small: 13,
    medium: 36,
    large: 42,
    huge: 80,
    oversize: 120,
  },
  yearVh: 0.2,
  yearVhMin: 0.15,
  yearVhMax: 0.25,
  soloVh: 0.3,
  spotJitterPx: 40,
  trackTight: 0.12,
  trackWord: 0.15,
  trackWide: 0.36,
  pale: "rgb(238, 246, 255)",
  amber: "rgb(176, 162, 42)",
  edge: "rgb(8, 18, 48)",
  markFill: "rgb(0, 0, 0)",
  core: "rgb(238, 246, 255)",
  pink: "rgb(255, 118, 168)",
  green: "rgb(72, 230, 168)",
  pinkAlpha: 0.3,
  greenAlpha: 0.24,
  pinkDx: -1.4,
  pinkDy: 0.6,
  greenDx: 1.5,
  greenDy: -0.5,
  offsetJitter: 0.35,
  bloom: 0.1,
  bloomInMark: 0.45,
  bloomOut: 1.15,
  bloomJitter: 0.03,
  edgeJitter: 0.04,
  gridStrength: 0.07,
  strokeEm: 0.012,
  greenExpand: 1,
  cellRatio: 0.85,
  pixelMeta: 1.08,
  pixelMedium: 1.22,
  pixelLarge: 1.32,
  pixelHuge: 1.4,
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
  topLeft: {x: 8, y: 15},
  topMid: {x: 38, y: 13},
  midLeft: {x: 10, y: 44},
  centerSide: {x: 54, y: 32},
  midLow: {x: 34, y: 64},
  botRight: {x: 70, y: 76},
  botLeft: {x: 11, y: 78},
  edgeRight: {x: 62, y: 50},
} as const;

export type RecallSpot = keyof typeof RECALL_SPOTS;
export type RecallMotion = "A" | "B" | "C" | "D";
export type RecallFace = "raster" | "display" | "meta";
export type RecallFrom = "year" | "title" | "category" | "slug" | "order";
export type RecallSpeed = keyof typeof RECALL.writeSpeed;
export type RecallInk = "pale" | "amber";
export type RecallMark = "after" | "before";
export type RecallInkMark = "digits" | "lastWord";
export type RecallScale = "year" | "medium" | "meta";

export const RECALL_BEATS = {
  y22: 0,
  kdh: RECALL.overlapTiming.tight,
  p1: RECALL.overlapTiming.mid,
  cat: RECALL.overlapTiming.loose,
  y22b: RECALL.recallDelay.soon,
  y24: RECALL.recallDelay.mid,
  sel: RECALL.recallDelay.late,
  slug: RECALL.recallDelay.slug,
  span: RECALL.recallDelay.span,
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
  scale?: RecallScale;
  yearVh?: number;
  soloGrow?: boolean;
  ink?: RecallInk;
  inkMark?: RecallInkMark;
  mark?: RecallMark;
  markDelay?: number;
  markLead?: number;
  markExit?: number;
  play: RecallOp[];
};

export const RECALL_FRAGS: RecallFrag[] = [
  {
    id: "y22",
    text: "2022",
    from: "year",
    fromIndex: 0,
    spot: "midLeft",
    face: "display",
    size: RECALL.sizes.medium,
    scale: "year",
    yearVh: 0.22,
    soloGrow: true,
    weight: 500,
    track: RECALL.trackTight,
    opacity: 0.92,
    motion: "B",
    start: RECALL_BEATS.y22,
    write: "fast",
    erase: "slow",
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL.holdDuration.primary},
      {op: "deleteTo", n: 1},
      {op: "hold", ms: RECALL.holdDuration.trace},
      {op: "delete"},
    ],
  },
  {
    id: "kdh",
    text: "KDH",
    spot: "topLeft",
    face: "meta",
    size: RECALL.sizes.meta,
    scale: "meta",
    weight: 400,
    track: RECALL.trackWide,
    opacity: 0.5,
    motion: "A",
    start: RECALL_BEATS.kdh,
    write: "fast",
    erase: "fast",
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL.holdDuration.flash},
      {op: "delete"},
    ],
  },
  {
    id: "p1",
    text: "PROJECT 01",
    from: "title",
    fromIndex: 0,
    maxChars: 10,
    spot: "topMid",
    face: "display",
    size: 40,
    scale: "medium",
    weight: 500,
    track: RECALL.trackTight,
    opacity: 0.92,
    motion: "B",
    start: RECALL_BEATS.p1,
    write: "mid",
    erase: "fast",
    inkMark: "digits",
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL.holdDuration.short},
      {op: "delete"},
    ],
  },
  {
    id: "cat",
    text: "MOVING IMAGE",
    from: "category",
    fromIndex: 0,
    maxChars: 12,
    spot: "edgeRight",
    face: "meta",
    size: 36,
    scale: "medium",
    weight: 400,
    track: RECALL.trackWord,
    opacity: 0.8,
    motion: "B",
    start: RECALL_BEATS.cat,
    write: "mid",
    erase: "mid",
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL.holdDuration.meta},
      {op: "delete"},
    ],
  },
  {
    id: "y22b",
    text: "2022",
    from: "year",
    fromIndex: 0,
    spot: "botLeft",
    face: "meta",
    size: RECALL.sizes.small,
    scale: "meta",
    weight: 400,
    track: RECALL.trackWord,
    opacity: 0.52,
    motion: "A",
    start: RECALL_BEATS.y22b,
    write: "fast",
    erase: "fast",
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
    spot: "centerSide",
    face: "raster",
    size: RECALL.sizes.large,
    scale: "year",
    yearVh: 0.18,
    weight: 400,
    track: RECALL.trackTight,
    opacity: 0.94,
    motion: "C",
    start: RECALL_BEATS.y24,
    write: "fast",
    erase: "fast",
    mark: "after",
    markDelay: 80,
    markExit: 200,
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL.holdDuration.long},
      {op: "delete"},
    ],
  },
  {
    id: "sel",
    text: "SELECTED",
    spot: "midLow",
    face: "display",
    size: 34,
    scale: "medium",
    weight: 400,
    track: RECALL.trackWord,
    opacity: 0.78,
    motion: "D",
    start: RECALL_BEATS.sel,
    write: "fast",
    erase: "fast",
    ink: "amber",
    mark: "before",
    markLead: 260,
    markExit: 90,
    play: [
      {op: "typeTo", n: 3, speed: "fast"},
      {op: "hold", ms: RECALL.holdDuration.pause},
      {op: "type", speed: "mid"},
      {op: "hold", ms: RECALL.holdDuration.meta},
      {op: "deleteTo", n: 3, speed: "fast"},
      {op: "hold", ms: RECALL.holdDuration.pause},
      {op: "type", speed: "fast"},
      {op: "hold", ms: RECALL.holdDuration.trace},
      {op: "delete", speed: "fast"},
    ],
  },
  {
    id: "slug",
    text: "ARCHIVE",
    from: "slug",
    fromIndex: 0,
    maxChars: 8,
    spot: "topMid",
    face: "meta",
    size: RECALL.sizes.meta,
    scale: "meta",
    weight: 400,
    track: RECALL.trackWide,
    opacity: 0.44,
    motion: "A",
    start: RECALL_BEATS.slug,
    write: "fast",
    erase: "fast",
    play: [
      {op: "typeTo", n: 4},
      {op: "hold", ms: RECALL.holdDuration.flash},
      {op: "delete"},
    ],
  },
  {
    id: "span",
    text: "22—26",
    spot: "botRight",
    face: "display",
    size: 32,
    scale: "medium",
    weight: 400,
    track: RECALL.trackWord,
    opacity: 0.82,
    motion: "A",
    start: RECALL_BEATS.span,
    write: "mid",
    erase: "fast",
    play: [
      {op: "type"},
      {op: "hold", ms: RECALL.holdDuration.short},
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
  ink: RecallInk;
  boxed: boolean;
  pinkDx: number;
  pinkDy: number;
  greenDx: number;
  greenDy: number;
  bloom: number;
  seed: number;
  ghost: boolean;
  fade: number;
  soft: number;
};

export type RecallGhost = {
  index: number;
  glyph: RecallGlyph;
  opacity: number;
  blur: number;
};

export type RecallCursor = {
  index: number;
  on: boolean;
};

export type RecallView = {
  id: string;
  key: string;
  text: string;
  glyphs: RecallGlyph[];
  ghosts: RecallGhost[];
  liveA: number;
  liveB: number;
  textLen: number;
  step: boolean;
  cursor: RecallCursor | null;
  markAlpha: number;
  anchor: "left" | "right";
  x: number;
  y: number;
  size: number;
  weight: number;
  track: number;
  opacity: number;
  trace: boolean;
  mark: boolean;
  markW: number;
  markH: number;
};

type TypeDir = "ltr" | "rtl";

type CompiledFrame = {
  at: number;
  until: number;
  a: number;
  b: number;
  cycle: number;
};

type HideEvent = {
  index: number;
  at: number;
  cycle: number;
  persist: number;
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
  typeDir: TypeDir;
  delDir: TypeDir;
  ink: RecallInk;
  inkMark?: RecallInkMark;
  scale: RecallScale;
  yearVh: number;
  soloGrow: boolean;
  step: boolean;
  wantCursor: boolean;
  cursorRank: number;
  extraBlinks: number;
  snapIndex: number;
  hides: HideEvent[];
  markAt: number;
  markUntil: number;
  markW: number;
  markH: number;
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
  const u = unit(seed);
  const range = kind === "type" ? RECALL.writeMs[speed] : RECALL.eraseMs[speed];
  const pace = kind === "type" ? RECALL.writeSpeed[speed] : RECALL.eraseSpeed[speed];
  if (ch === " ") {
    return Math.max(12, range[0] * 0.45 * pace);
  }
  return (range[0] + u * (range[1] - range[0])) * pace;
}

function emptyRange(len: number, type: TypeDir): [number, number] {
  return type === "ltr" ? [0, 0] : [len, len];
}

function glyphInk(frag: CompiledFrag, index: number, ch: string): RecallInk {
  if (frag.ink === "amber") {
    return "amber";
  }
  if (frag.inkMark === "digits" && /[0-9]/.test(ch)) {
    return "amber";
  }
  if (frag.inkMark === "lastWord") {
    const last = frag.text.split(/\s+/).at(-1) ?? "";
    const start = frag.text.lastIndexOf(last);
    if (start >= 0 && index >= start) {
      return "amber";
    }
  }
  return "pale";
}

function viewSize() {
  if (typeof window === "undefined") {
    return {w: 1440, h: 900};
  }
  return {w: window.innerWidth, h: window.innerHeight};
}

function sawFullWord(frag: CompiledFrag, cycle: number, ms: number) {
  return frag.frames.some(
    (frame) =>
      frame.cycle === cycle &&
      frame.b - frame.a === frag.text.length &&
      frame.at <= ms,
  );
}

function resolveFragSize(frag: CompiledFrag, chars: number, fullSeen: boolean) {
  const {h} = viewSize();
  if (frag.soloGrow && chars === 1 && fullSeen) {
    return Math.round(h * RECALL.soloVh);
  }
  if (frag.scale === "year") {
    const vh = Math.min(RECALL.yearVhMax, Math.max(RECALL.yearVhMin, frag.yearVh));
    return Math.round(h * vh);
  }
  return frag.size;
}

function spotJitter(id: string) {
  const {w, h} = viewSize();
  const px = RECALL.spotJitterPx;
  return {
    x: (unit(`${id}:jx`) - 0.5) * 2 * (px / w) * 100,
    y: (unit(`${id}:jy`) - 0.5) * 2 * (px / h) * 100,
  };
}

function glyphLook(
  id: string,
  cycle: number,
  index: number,
  ch: string,
  frag: CompiledFrag,
  size: number,
  boxed: boolean,
): RecallGlyph {
  const s = hash32(`${id}:${cycle}:${index}:${ch}`);
  const u = (s % 10000) / 10000;
  const v = ((s >>> 8) % 10000) / 10000;
  const w = ((s >>> 16) % 10000) / 10000;
  const q = ((s >>> 20) % 10000) / 10000;
  const jitter = RECALL.offsetJitter;
  const huge = size >= RECALL.sizes.huge;
  return {
    ch,
    face: frag.face,
    size: size * (0.98 + u * 0.03),
    sx: huge ? 0.9 + u * 0.04 : 0.94 + u * 0.05,
    sy: 1 + v * 0.03,
    dy: (v - 0.5) * 0.04,
    track: frag.track + (w - 0.5) * 0.02,
    weight: Math.min(500, Math.max(400, frag.weight + (u < 0.22 ? 50 : u > 0.82 ? -50 : 0))),
    ink: glyphInk(frag, index, ch),
    boxed,
    pinkDx: RECALL.pinkDx + (u - 0.5) * jitter,
    pinkDy: RECALL.pinkDy + (v - 0.5) * jitter,
    greenDx: RECALL.greenDx + (w - 0.5) * jitter,
    greenDy: RECALL.greenDy + (q - 0.5) * jitter,
    bloom: RECALL.bloom + (q - 0.5) * RECALL.bloomJitter,
    seed: s,
    ghost: false,
    fade: 1,
    soft: 0.5,
  };
}

function charBornAt(frames: CompiledFrame[], cycle: number, index: number) {
  for (const frame of frames) {
    if (frame.cycle === cycle && index >= frame.a && index < frame.b) {
      return frame.at;
    }
  }
  return 0;
}

function collectHides(id: string, frames: CompiledFrame[]): HideEvent[] {
  const hides: HideEvent[] = [];
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    const next = frames[i + 1];
    const hideAt = next ? next.at : frame.until;
    for (let index = frame.a; index < frame.b; index += 1) {
      const stays =
        Boolean(next) &&
        next.cycle === frame.cycle &&
        index >= next.a &&
        index < next.b;
      if (stays) {
        continue;
      }
      hides.push({
        index,
        at: hideAt,
        cycle: frame.cycle,
        persist: retroGhostMs(id, frame.cycle, index, hideAt),
      });
    }
  }
  return hides;
}

function caretIndex(frag: CompiledFrag, frame: CompiledFrame | null, prev: CompiledFrame | null) {
  if (!frame) {
    const last = frag.frames[frag.frames.length - 1];
    return frag.delDir === "ltr" ? last?.a ?? 0 : last?.b ?? frag.text.length;
  }
  const writing = Boolean(
    prev && (frame.b > prev.b || frame.a < prev.a),
  );
  const deleting = Boolean(
    prev && (frame.b < prev.b || frame.a > prev.a),
  );
  if (writing || !prev) {
    return frag.typeDir === "ltr" ? frame.b : frame.a;
  }
  if (deleting) {
    return frag.delDir === "ltr" ? frame.a : frame.b;
  }
  return frag.typeDir === "ltr" ? frame.b : frame.a;
}

function markWindow(
  frag: RecallFrag,
  text: string,
  frames: CompiledFrame[],
): {at: number; until: number} {
  if (!frag.mark || !frames.length) {
    if (frag.mark === "before") {
      const at = Math.max(0, frag.start - (frag.markLead ?? 180));
      return {at, until: Math.min(RECALL.durationMs, frag.start + 360)};
    }
    return {at: 0, until: 0};
  }
  const len = text.length;
  let fullAt: number | null = null;
  let lastFullUntil: number | null = null;
  for (const frame of frames) {
    if (frame.b - frame.a === len) {
      if (fullAt === null) {
        fullAt = frame.at;
      }
      lastFullUntil = frame.until;
    }
  }
  const firstAt = frames[0].at;
  const lastUntil = frames[frames.length - 1].until;
  if (frag.mark === "before") {
    return {
      at: Math.max(0, frag.start - (frag.markLead ?? 180)),
      until: Math.max(firstAt + 80, (lastFullUntil ?? lastUntil) - (frag.markExit ?? 140)),
    };
  }
  const start = (fullAt ?? firstAt) + (frag.markDelay ?? 160);
  const end = (lastFullUntil ?? lastUntil) - (frag.markExit ?? 160);
  if (end <= start) {
    return {at: start, until: Math.min(RECALL.durationMs, start + 220)};
  }
  return {at: start, until: end};
}

function markBox(text: string, size: number, track: number) {
  return {
    markW: Math.max(size, text.length * size * (0.48 + Math.max(0, track) * 0.4)),
    markH: size * 1.04,
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
  if (frag.maxChars && text.length > frag.maxChars) {
    text = text.slice(0, frag.maxChars);
  }
  return text;
}

function compileFrag(frag: RecallFrag, text: string): CompiledFrag {
  const {type, del, anchor} = motionDirs(frag.motion);
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
      if (frames.length) {
        frames[frames.length - 1].until = t;
      }
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
    const writeMul = step.speed ?? frag.write ?? "mid";
    const eraseMul = step.speed ?? frag.erase ?? "mid";

    if (writing) {
      cycle += 1;
      if (visible() === 0) {
        [a, b] = emptyRange(len, type);
      }
    }

    let guard = 0;
    while (visible() !== goal && guard < 48 && t < RECALL.durationMs) {
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
            t += stepMs("type", `${frag.id}:t:${opIndex}:${b}`, ch, writeMul);
          }
          b += 1;
        } else {
          if (a <= 0) {
            break;
          }
          const ch = text[a - 1] ?? "";
          if (!first) {
            t += stepMs("type", `${frag.id}:t:${opIndex}:${a}`, ch, writeMul);
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
        t += stepMs("delete", `${frag.id}:d:${opIndex}:${a}`, ch, eraseMul);
        a += 1;
      } else {
        if (b <= a) {
          break;
        }
        const ch = text[b - 1] ?? "";
        t += stepMs("delete", `${frag.id}:d:${opIndex}:${b}`, ch, eraseMul);
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
    const last = frames[frames.length - 1];
    last.until = Math.min(Math.max(last.until, t), endBy);
    for (const frame of frames) {
      frame.at = Math.min(frame.at, endBy);
      frame.until = Math.min(frame.until, endBy);
    }
  }

  const mark = markWindow(frag, text, frames);
  const scale = frag.scale ?? (frag.size <= RECALL.sizes.small ? "meta" : "medium");
  const track = retroTrackFor(frag.id, scale);
  const step = retroUnit(`${frag.id}:step`) < RECALL_RETRO.stepChance;
  const box = markBox(text, frag.size, track);
  return {
    id: frag.id,
    text,
    spot: frag.spot,
    face: frag.face,
    size: frag.size,
    weight: frag.weight,
    track,
    opacity: frag.opacity,
    anchor,
    ink: frag.ink ?? "pale",
    inkMark: frag.inkMark,
    scale,
    yearVh: frag.yearVh ?? RECALL.yearVh,
    soloGrow: Boolean(frag.soloGrow),
    typeDir: type,
    delDir: del,
    step,
    wantCursor: retroUnit(`${frag.id}:cur`) < RECALL_RETRO.cursorChance,
    cursorRank: retroUnit(`${frag.id}:crank`),
    extraBlinks: retroExtraBlinks(frag.id),
    snapIndex:
      !step &&
      text.length > 1 &&
      retroUnit(`${frag.id}:hassnap`) < RECALL_RETRO.snapLetterChance
        ? Math.floor(retroUnit(`${frag.id}:snapch`) * text.length)
        : -1,
    hides: collectHides(frag.id, frames),
    markAt: mark.at,
    markUntil: mark.until,
    markW: box.markW,
    markH: box.markH,
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
  const compiled = compiledFor(pool);
  const drafts: RecallView[] = [];
  const cursorIds: {id: string; rank: number}[] = [];
  for (const frag of compiled) {
    const frame = frameAt(frag.frames, ms);
    const frameIdx = frame ? frag.frames.indexOf(frame) : -1;
    const prev = frameIdx > 0 ? frag.frames[frameIdx - 1] : null;
    const marked = frag.markUntil > frag.markAt && ms >= frag.markAt && ms < frag.markUntil;
    const live = Boolean(frame && ms < frame.until && frame.b > frame.a);
    const liveA = live && frame ? frame.a : 0;
    const liveB = live && frame ? frame.b : 0;
    const slice = live && frame ? frag.text.slice(liveA, liveB) : "";
    const ghosts: RecallGhost[] = [];
    const sizeHint = resolveFragSize(
      frag,
      slice.length || 1,
      sawFullWord(frag, frame?.cycle ?? 0, ms),
    );
    for (const hide of frag.hides) {
      if (ms < hide.at || ms >= hide.at + hide.persist) {
        continue;
      }
      const look = retroGhostLook(ms - hide.at, hide.persist, frag.step, frag.id);
      if (look.opacity <= 0.01) {
        continue;
      }
      const ch = frag.text[hide.index] ?? "";
      const glyph = glyphLook(frag.id, hide.cycle, hide.index, ch, frag, sizeHint, false);
      ghosts.push({
        index: hide.index,
        glyph: {...glyph, ghost: true, fade: look.opacity, soft: look.blur},
        opacity: look.opacity,
        blur: look.blur,
      });
    }
    const last = frag.frames[frag.frames.length - 1];
    const extraMs = frag.extraBlinks * RECALL_RETRO.cursorPeriod * 2;
    const inCursor =
      frag.wantCursor &&
      ((live && Boolean(frame)) || Boolean(last && ms >= last.until && ms < last.until + extraMs));
    if (!live && !marked && !ghosts.length && !inCursor) {
      continue;
    }
    const markAlpha = retroMarkAlpha(ms, frag.markAt, frag.markUntil, frag.step, frag.id);
    const spot = RECALL_SPOTS[frag.spot];
    const jitter = spotJitter(frag.id);
    const size = resolveFragSize(frag, slice.length, sawFullWord(frag, frame?.cycle ?? 0, ms));
    const box = markBox(frag.text, size, frag.track);
    const cursor = inCursor
      ? {index: caretIndex(frag, live ? frame : last ?? null, prev), on: retroCursorOn(ms)}
      : null;
    if (cursor) {
      cursorIds.push({id: frag.id, rank: frag.cursorRank});
    }
    drafts.push({
      id: frag.id,
      key: `${frag.id}-${frame?.cycle ?? 0}-${liveA}-${liveB}-${marked ? "m" : "x"}-${size}-${ghosts.length}`,
      text: slice,
      glyphs: slice
        ? Array.from(slice, (ch, i) => {
            const index = liveA + i;
            const glyph = glyphLook(
              frag.id,
              frame?.cycle ?? 0,
              index,
              ch,
              frag,
              size,
              markAlpha > 0.5,
            );
            const snap = frag.step || index === frag.snapIndex;
            const born = charBornAt(frag.frames, frame?.cycle ?? 0, index);
            const look = retroAppearLook(ms - born, retroAppearMs(frag.id, index), snap);
            return {...glyph, fade: look.fade, soft: Math.round(look.soft * 4) / 4};
          })
        : [],
      ghosts,
      liveA,
      liveB,
      textLen: frag.text.length,
      step: frag.step,
      cursor,
      markAlpha,
      anchor: frag.anchor,
      x: spot.x + jitter.x,
      y: spot.y + jitter.y,
      size,
      weight: frag.weight,
      track: frag.track,
      opacity: frag.opacity,
      trace: false,
      mark: markAlpha > 0.04,
      markW: box.markW,
      markH: box.markH,
    });
  }
  cursorIds.sort((a, b) => a.rank - b.rank);
  const keep = new Set(cursorIds.slice(0, RECALL_RETRO.cursorMax).map((item) => item.id));
  for (const view of drafts) {
    if (view.cursor && !keep.has(view.id)) {
      view.cursor = null;
    }
  }
  return drafts;
}
