import {
  RECALL,
  resolvePlaybackTrace,
  resolveRecall,
  type RecallPool,
  type RecallView,
} from "@/components/crt/crtRecall";

const EMPTY_RECALL_POOL: RecallPool = {years: [], titles: [], categories: [], slugs: [], orders: []};

export const TRANSIT = {
  letters: ["W", "E", "L", "C", "O", "M", "E"] as const,
  freezeMs: 500,
  colorMs: 920,
  typeMs: 700,
  deleteMs: 540,
  fragMs: RECALL.durationMs,
  silenceMs: RECALL.silenceMs,
};

export const COLOR_KEYS = [
  {u: 0, hue: 0, sat: 1, bright: 1, contrast: 1, sepia: 0},
  {u: 0.2, hue: 3, sat: 0.97, bright: 1, contrast: 1, sepia: 0.015},
  {u: 0.46, hue: 5, sat: 0.93, bright: 0.995, contrast: 1.01, sepia: 0.03},
  {u: 0.5, hue: 14, sat: 0.8, bright: 1.015, contrast: 0.97, sepia: 0.04},
  {u: 0.72, hue: 8, sat: 0.64, bright: 0.975, contrast: 0.95, sepia: 0.09},
  {u: 0.9, hue: -12, sat: 0.56, bright: 0.965, contrast: 0.98, sepia: 0.05},
  {u: 1, hue: -6, sat: 0.6, bright: 0.97, contrast: 0.97, sepia: 0.07},
] as const;

type TypeEvent = {
  at: number;
  i: number;
  hold: number;
  dy?: number;
  dx?: number;
  sx?: number;
  sy?: number;
  rot?: number;
  opacity?: number;
  clip?: number;
  ch?: string;
};

const TYPE_EVENTS: TypeEvent[] = [
  {at: 0, i: 3, hold: 70, dy: 5},
  {at: 200, i: 5, hold: 95, clip: 0.42},
  {at: 430, i: 6, hold: 50, opacity: 0},
  {at: 560, i: 2, hold: 75, sx: 0.58},
  {at: 640, i: 4, hold: 55, ch: "▪"},
];

type DeleteEvent = {
  at: number;
  hide?: number[];
  ch?: {i: number; ch: string};
};

const DELETE_EVENTS: DeleteEvent[] = [
  {at: 0, hide: [6]},
  {at: 70, ch: {i: 5, ch: "▦"}},
  {at: 140, hide: [5, 4]},
  {at: 220, hide: [2, 1]},
  {at: 310, hide: [0]},
  {at: 470, hide: [3]},
];

export type GlyphFx = {
  ch: string;
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  rot: number;
  opacity: number;
  clip: number;
  hidden: boolean;
};

export type TransitStage =
  | "freeze"
  | "color"
  | "type"
  | "delete"
  | "frag"
  | "silence"
  | "done";

export type ColorGrade = {
  hue: number;
  sat: number;
  bright: number;
  contrast: number;
  sepia: number;
};

export type TransitFrame = {
  stage: TransitStage;
  color: ColorGrade;
  hideShaderText: boolean;
  glyphs: GlyphFx[];
  frags: RecallView[];
  done: boolean;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function idleGlyph(ch: string): GlyphFx {
  return {
    ch,
    dx: 0,
    dy: 0,
    sx: 1,
    sy: 1,
    rot: 0,
    opacity: 1,
    clip: 1,
    hidden: false,
  };
}

export function sampleColor(u: number): ColorGrade {
  const t = clamp01(u);
  let prev: (typeof COLOR_KEYS)[number] = COLOR_KEYS[0];
  let next: (typeof COLOR_KEYS)[number] = COLOR_KEYS[COLOR_KEYS.length - 1];
  for (let i = 0; i < COLOR_KEYS.length - 1; i += 1) {
    if (t >= COLOR_KEYS[i].u && t <= COLOR_KEYS[i + 1].u) {
      prev = COLOR_KEYS[i];
      next = COLOR_KEYS[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, next.u - prev.u);
  const local = (t - prev.u) / span;
  const stepped = span < 0.08 ? (local < 0.15 ? 0 : 1) : local * local * (3 - 2 * local);
  return {
    hue: mix(prev.hue, next.hue, stepped),
    sat: mix(prev.sat, next.sat, stepped),
    bright: mix(prev.bright, next.bright, stepped),
    contrast: mix(prev.contrast, next.contrast, stepped),
    sepia: mix(prev.sepia, next.sepia, stepped),
  };
}

export function colorFilter(color: ColorGrade) {
  return `hue-rotate(${color.hue.toFixed(2)}deg) saturate(${color.sat.toFixed(3)}) brightness(${color.bright.toFixed(3)}) contrast(${color.contrast.toFixed(3)}) sepia(${color.sepia.toFixed(3)})`;
}

function applyType(glyphs: GlyphFx[], t: number) {
  for (const event of TYPE_EVENTS) {
    if (t < event.at || t >= event.at + event.hold) {
      continue;
    }
    const glyph = glyphs[event.i];
    if (!glyph) {
      continue;
    }
    if (event.dy !== undefined) {
      glyph.dy = event.dy;
    }
    if (event.dx !== undefined) {
      glyph.dx = event.dx;
    }
    if (event.sx !== undefined) {
      glyph.sx = event.sx;
    }
    if (event.sy !== undefined) {
      glyph.sy = event.sy;
    }
    if (event.rot !== undefined) {
      glyph.rot = event.rot;
    }
    if (event.opacity !== undefined) {
      glyph.opacity = event.opacity;
    }
    if (event.clip !== undefined) {
      glyph.clip = event.clip;
    }
    if (event.ch !== undefined) {
      glyph.ch = event.ch;
    }
  }
}

function applyDelete(glyphs: GlyphFx[], t: number) {
  for (const event of DELETE_EVENTS) {
    if (t < event.at) {
      continue;
    }
    if (event.hide) {
      for (const i of event.hide) {
        if (glyphs[i]) {
          glyphs[i].hidden = true;
        }
      }
    }
    if (event.ch && glyphs[event.ch.i] && !glyphs[event.ch.i].hidden) {
      glyphs[event.ch.i].ch = event.ch.ch;
    }
  }
}

export function resolveTransit(ms: number, pool?: RecallPool): TransitFrame {
  const freeze = TRANSIT.freezeMs;
  const colorEnd = freeze + TRANSIT.colorMs;
  const typeEnd = colorEnd + TRANSIT.typeMs;
  const deleteEnd = typeEnd + TRANSIT.deleteMs;
  const fragEnd = deleteEnd + TRANSIT.fragMs;
  const end = fragEnd + TRANSIT.silenceMs;

  const glyphs = TRANSIT.letters.map((ch) => idleGlyph(ch));
  const color =
    ms <= freeze ? sampleColor(0) : sampleColor(clamp01((ms - freeze) / TRANSIT.colorMs));

  if (ms < freeze) {
    return {
      stage: "freeze",
      color,
      hideShaderText: false,
      glyphs,
      frags: [],
      done: false,
    };
  }
  if (ms < colorEnd) {
    return {
      stage: "color",
      color,
      hideShaderText: false,
      glyphs,
      frags: [],
      done: false,
    };
  }
  if (ms < typeEnd) {
    applyType(glyphs, ms - colorEnd);
    return {
      stage: "type",
      color,
      hideShaderText: true,
      glyphs,
      frags: [],
      done: false,
    };
  }
  if (ms < deleteEnd) {
    applyDelete(glyphs, ms - typeEnd);
    return {
      stage: "delete",
      color,
      hideShaderText: true,
      glyphs,
      frags: [],
      done: false,
    };
  }
  if (ms < fragEnd) {
    const local = ms - deleteEnd;
    return {
      stage: "frag",
      color,
      hideShaderText: true,
      glyphs: glyphs.map((glyph) => ({...glyph, hidden: true})),
      frags: resolveRecall(local, pool ?? EMPTY_RECALL_POOL),
      done: false,
    };
  }
  if (ms < end) {
    const fade = 1 - (ms - fragEnd) / Math.max(TRANSIT.silenceMs, 1);
    return {
      stage: "silence",
      color,
      hideShaderText: true,
      glyphs: glyphs.map((glyph) => ({...glyph, hidden: true})),
      frags: resolvePlaybackTrace(Math.max(0, fade)),
      done: false,
    };
  }
  return {
    stage: "done",
    color,
    hideShaderText: true,
    glyphs: glyphs.map((glyph) => ({...glyph, hidden: true})),
    frags: [],
    done: true,
  };
}

export type TextBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export function keyWelcomePlate(
  src: HTMLCanvasElement,
  bounds: TextBounds,
): HTMLCanvasElement {
  const width = src.width;
  const height = src.height;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) {
    return out;
  }
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const x0 = Math.floor(bounds.minX * width);
  const x1 = Math.ceil(bounds.maxX * width);
  const y0 = Math.floor(bounds.minY * height);
  const y1 = Math.ceil(bounds.maxY * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const inside = x >= x0 && x < x1 && y >= y0 && y < y1;
      if (!inside) {
        data[i + 3] = 0;
        continue;
      }
      const lum = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
      if (lum < 0.56) {
        data[i + 3] = 0;
      } else {
        data[i + 3] = Math.round(Math.min(255, ((lum - 0.56) / 0.28) * 255));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export type GlyphSlice = {
  canvas: HTMLCanvasElement;
  left: number;
  top: number;
  width: number;
  height: number;
};

export function sliceGlyphs(
  keyed: HTMLCanvasElement,
  bounds: TextBounds,
  cssW: number,
  cssH: number,
): GlyphSlice[] {
  const count = TRANSIT.letters.length;
  const x0 = bounds.minX * keyed.width;
  const x1 = bounds.maxX * keyed.width;
  const y0 = bounds.minY * keyed.height;
  const y1 = bounds.maxY * keyed.height;
  const sliceW = (x1 - x0) / count;
  const sliceH = y1 - y0;
  return Array.from({length: count}, (_, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(sliceW));
    canvas.height = Math.max(1, Math.ceil(sliceH));
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(
      keyed,
      x0 + i * sliceW,
      y0,
      sliceW,
      sliceH,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return {
      canvas,
      left: ((x0 + i * sliceW) / keyed.width) * cssW,
      top: (y0 / keyed.height) * cssH,
      width: (sliceW / keyed.width) * cssW,
      height: (sliceH / keyed.height) * cssH,
    };
  });
}
