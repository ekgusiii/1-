import {
  RECALL,
  resolveRecall,
  type RecallPool,
  type RecallView,
} from "@/components/crt/crtRecall";

const EMPTY_RECALL_POOL: RecallPool = {years: [], titles: [], categories: [], slugs: [], orders: []};

export const TRANSIT = {
  freezeMs: 500,
  fadeMs: 1300,
  sinkMs: 1200,
  blankMs: 300,
  fragMs: RECALL.durationMs,
  silenceMs: RECALL.silenceMs,
  fade: {
    satFrom: 1,
    satTo: 0.35,
    contrastFrom: 1,
    contrastTo: 0.75,
    brightFrom: 1,
    brightTo: 1.12,
    sepiaFrom: 0,
    sepiaTo: 0.15,
    bloomPxFrom: 2,
    bloomPxTo: 4,
    bloomAlphaFrom: 0,
    bloomAlphaTo: 0.2,
    scanFrom: 0.045,
    scanTo: 0.12,
  },
  sink: {
    welcomeFadeMs: 900,
    welcomeBlurTo: 5,
  },
  hitch: {
    countMin: 2,
    countMax: 3,
    firstDelayMin: 160,
    firstDelayMax: 360,
    gapMin: 300,
    gapMax: 600,
    liftMsMin: 80,
    liftMsMax: 120,
    liftPxMin: 1,
    liftPxMax: 2,
    dimMs: 150,
    dimBright: 0.08,
    bandMs: 20,
    bandHMin: 20,
    bandHMax: 40,
    bandDxMin: 4,
    bandDxMax: 8,
  },
} as const;

export function transitLeadMs() {
  return TRANSIT.freezeMs + TRANSIT.fadeMs + TRANSIT.sinkMs + TRANSIT.blankMs;
}

export type TransitStage = "freeze" | "fade" | "sink" | "blank" | "frag" | "silence" | "done";

export type TransitBand = {y: number; h: number; dx: number};

export type TransitStill = {
  show: boolean;
  opacity: number;
  blur: number;
  sat: number;
  contrast: number;
  bright: number;
  sepia: number;
  bloomPx: number;
  bloomAlpha: number;
  scan: number;
  dy: number;
  field: number;
  fieldBlend: "multiply" | "color" | "normal";
  band: TransitBand | null;
};

export type TransitFrame = {
  stage: TransitStage;
  hideShaderText: boolean;
  still: TransitStill;
  frags: RecallView[];
  done: boolean;
};

type Hitch = {
  kind: "lift" | "dim" | "band";
  at: number;
  dur: number;
  px: number;
  y: number;
  h: number;
  dx: number;
};

let hitches: Hitch[] = [];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(t: number) {
  const u = clamp01(t);
  return u < 0.5 ? 2 * u * u : 1 - (2 * (1 - u) * (1 - u));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng: () => number, min: number, max: number) {
  return min + (max - min) * rng();
}

export function armTransitHitches(seed = Math.floor(Math.random() * 1e9)) {
  const rng = mulberry32(seed);
  const cfg = TRANSIT.hitch;
  const count = Math.round(randRange(rng, cfg.countMin, cfg.countMax));
  const kinds: Hitch["kind"][] = ["lift", "dim", "band"];
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = kinds[i];
    kinds[i] = kinds[j];
    kinds[j] = swap;
  }
  const fadeStart = TRANSIT.freezeMs;
  const fadeEnd = fadeStart + TRANSIT.fadeMs;
  let at = fadeStart + randRange(rng, cfg.firstDelayMin, cfg.firstDelayMax);
  hitches = [];
  for (let i = 0; i < count; i += 1) {
    const kind = kinds[i % kinds.length];
    const dur =
      kind === "lift"
        ? randRange(rng, cfg.liftMsMin, cfg.liftMsMax)
        : kind === "dim"
          ? cfg.dimMs
          : cfg.bandMs;
    if (at + dur >= fadeEnd) {
      break;
    }
    hitches.push({
      kind,
      at,
      dur,
      px: Math.round(randRange(rng, cfg.liftPxMin, cfg.liftPxMax)),
      y: randRange(rng, 0.18, 0.72),
      h: randRange(rng, cfg.bandHMin, cfg.bandHMax),
      dx: Math.round(randRange(rng, cfg.bandDxMin, cfg.bandDxMax)) * (rng() < 0.5 ? -1 : 1),
    });
    at += dur + randRange(rng, cfg.gapMin, cfg.gapMax);
  }
}

function idleStill(): TransitStill {
  return {
    show: false,
    opacity: 1,
    blur: 0,
    sat: 1,
    contrast: 1,
    bright: 1,
    sepia: 0,
    bloomPx: 0,
    bloomAlpha: 0,
    scan: 0,
    dy: 0,
    field: 0,
    fieldBlend: "normal",
    band: null,
  };
}

function applyHitch(still: TransitStill, ms: number) {
  for (const hitch of hitches) {
    if (ms < hitch.at || ms >= hitch.at + hitch.dur) {
      continue;
    }
    if (hitch.kind === "lift") {
      still.dy = -hitch.px;
    }
    if (hitch.kind === "dim") {
      still.bright = Math.max(0.7, still.bright - TRANSIT.hitch.dimBright);
    }
    if (hitch.kind === "band") {
      still.band = {y: hitch.y, h: hitch.h, dx: hitch.dx};
    }
  }
}

function fadeStill(u: number): TransitStill {
  const t = easeInOut(u);
  const fade = TRANSIT.fade;
  return {
    show: true,
    opacity: 1,
    blur: 0,
    sat: mix(fade.satFrom, fade.satTo, t),
    contrast: mix(fade.contrastFrom, fade.contrastTo, t),
    bright: mix(fade.brightFrom, fade.brightTo, t),
    sepia: mix(fade.sepiaFrom, fade.sepiaTo, t),
    bloomPx: mix(fade.bloomPxFrom, fade.bloomPxTo, t),
    bloomAlpha: mix(fade.bloomAlphaFrom, fade.bloomAlphaTo, t),
    scan: mix(fade.scanFrom, fade.scanTo, t),
    dy: 0,
    field: 0,
    fieldBlend: "normal",
    band: null,
  };
}

function sinkStill(u: number): TransitStill {
  const fade = fadeStill(1);
  const gone = clamp01(u / (TRANSIT.sink.welcomeFadeMs / TRANSIT.sinkMs));
  fade.opacity = 1 - easeInOut(gone);
  fade.blur = mix(0, TRANSIT.sink.welcomeBlurTo, easeInOut(gone));
  fade.bloomAlpha = fade.bloomAlpha * (1 - gone);
  fade.field = easeInOut(u);
  fade.fieldBlend = u < 0.52 ? "multiply" : u < 0.82 ? "color" : "normal";
  fade.scan = mix(TRANSIT.fade.scanTo, 0.07, u);
  return fade;
}

export function resolveTransit(ms: number, pool?: RecallPool): TransitFrame {
  const freeze = TRANSIT.freezeMs;
  const fadeEnd = freeze + TRANSIT.fadeMs;
  const sinkEnd = fadeEnd + TRANSIT.sinkMs;
  const blankEnd = sinkEnd + TRANSIT.blankMs;
  const fragEnd = blankEnd + TRANSIT.fragMs;
  const end = fragEnd + TRANSIT.silenceMs;

  if (ms < freeze) {
    return {
      stage: "freeze",
      hideShaderText: false,
      still: {...idleStill(), show: true, scan: TRANSIT.fade.scanFrom},
      frags: [],
      done: false,
    };
  }
  if (ms < fadeEnd) {
    const still = fadeStill((ms - freeze) / TRANSIT.fadeMs);
    applyHitch(still, ms);
    return {
      stage: "fade",
      hideShaderText: true,
      still,
      frags: [],
      done: false,
    };
  }
  if (ms < sinkEnd) {
    return {
      stage: "sink",
      hideShaderText: true,
      still: sinkStill((ms - fadeEnd) / TRANSIT.sinkMs),
      frags: [],
      done: false,
    };
  }
  if (ms < blankEnd) {
    return {
      stage: "blank",
      hideShaderText: true,
      still: {
        ...idleStill(),
        field: 1,
        fieldBlend: "normal",
        scan: 0.07,
      },
      frags: [],
      done: false,
    };
  }
  if (ms < fragEnd) {
    return {
      stage: "frag",
      hideShaderText: true,
      still: {
        ...idleStill(),
        field: 1,
        fieldBlend: "normal",
        scan: 0.07,
      },
      frags: resolveRecall(ms - blankEnd, pool ?? EMPTY_RECALL_POOL),
      done: false,
    };
  }
  if (ms < end) {
    return {
      stage: "silence",
      hideShaderText: true,
      still: {
        ...idleStill(),
        field: 1,
        fieldBlend: "normal",
        scan: 0.07,
      },
      frags: [],
      done: false,
    };
  }
  return {
    stage: "done",
    hideShaderText: true,
    still: idleStill(),
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
