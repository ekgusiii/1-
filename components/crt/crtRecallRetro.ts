export const RECALL_RETRO = {
  ghostMsMin: 300,
  ghostMsMax: 600,
  ghostSnap: 0.35,
  ghostBlurFrom: 0.5,
  ghostBlurTo: 2,
  ghostFill: "#c5dcff",
  stepChance: 0.2,
  appearMsMin: 180,
  appearMsMax: 260,
  appearBlurFrom: 3,
  appearBlurTo: 0.5,
  snapLetterChance: 0.32,
  trackYear: 0.12,
  trackMid: 0.15,
  trackMeta: 0.2,
  trackWide: 0.36,
  wideChance: 0.15,
  stepLevels: 4,
  stepMsMin: 60,
  stepMsMax: 90,
  stepMarks: 3,
  cursorChance: 0.31,
  cursorMax: 2,
  cursorW: 0.6,
  cursorH: 1,
  cursorPeriod: 530,
  cursorExtraMin: 1,
  cursorExtraMax: 2,
  rollHMin: 0.15,
  rollHMax: 0.2,
  rollH: 0.175,
  rollMsMin: 7000,
  rollMsMax: 10000,
  rollMs: 8500,
  rollAlpha: 0.045,
  barrel: 0.015,
  radius: 0.015,
  cornerExtra: 0.08,
} as const;

export function retroUnit(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function retroGhostMs(id: string, cycle: number, index: number, at: number) {
  const u = retroUnit(`${id}:ghost:${cycle}:${index}:${at}`);
  return RECALL_RETRO.ghostMsMin + u * (RECALL_RETRO.ghostMsMax - RECALL_RETRO.ghostMsMin);
}

export function retroAppearMs(id: string, index: number) {
  const u = retroUnit(`${id}:appear:${index}`);
  return RECALL_RETRO.appearMsMin + u * (RECALL_RETRO.appearMsMax - RECALL_RETRO.appearMsMin);
}

export function retroEaseOut(t: number) {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) * (1 - u);
}

export function retroAppearLook(age: number, persist: number, snap: boolean) {
  if (snap || persist <= 0) {
    return {fade: 1, soft: RECALL_RETRO.appearBlurTo};
  }
  const u = retroEaseOut(age / persist);
  return {
    fade: u,
    soft:
      RECALL_RETRO.appearBlurFrom +
      (RECALL_RETRO.appearBlurTo - RECALL_RETRO.appearBlurFrom) * u,
  };
}

export function retroTrackFor(id: string, scale: "year" | "medium" | "meta") {
  if (retroUnit(`${id}:wide`) < RECALL_RETRO.wideChance) {
    return RECALL_RETRO.trackWide;
  }
  if (scale === "year") {
    return RECALL_RETRO.trackYear;
  }
  if (scale === "meta") {
    return RECALL_RETRO.trackMeta;
  }
  return RECALL_RETRO.trackMid;
}

export function retroStepMs(id: string) {
  const u = retroUnit(`${id}:stepms`);
  return RECALL_RETRO.stepMsMin + u * (RECALL_RETRO.stepMsMax - RECALL_RETRO.stepMsMin);
}

export function retroQuantize(value: number, levels: number) {
  if (levels <= 1) {
    return value <= 0 ? 0 : 1;
  }
  const step = 1 / (levels - 1);
  return Math.round(value / step) * step;
}

export function retroGhostLook(age: number, persist: number, step: boolean, id: string) {
  const u = Math.min(1, Math.max(0, age / persist));
  if (step) {
    const levels = RECALL_RETRO.stepLevels;
    const hold = retroStepMs(id);
    const idx = Math.min(levels - 1, Math.floor(age / hold));
    const stops = [RECALL_RETRO.ghostSnap, 0.22, 0.1, 0];
    return {
      opacity: stops[idx] ?? 0,
      blur:
        RECALL_RETRO.ghostBlurFrom +
        (RECALL_RETRO.ghostBlurTo - RECALL_RETRO.ghostBlurFrom) * (idx / Math.max(1, levels - 1)),
    };
  }
  return {
    opacity: RECALL_RETRO.ghostSnap * (1 - u),
    blur:
      RECALL_RETRO.ghostBlurFrom +
      (RECALL_RETRO.ghostBlurTo - RECALL_RETRO.ghostBlurFrom) * u,
  };
}

export function retroMarkAlpha(ms: number, at: number, until: number, step: boolean, id: string) {
  if (until <= at || ms < at || ms >= until) {
    return 0;
  }
  if (!step) {
    return 1;
  }
  const cut = retroUnit(`${id}:markcut`) < 0.45;
  if (cut) {
    return 1;
  }
  const hold = retroStepMs(`${id}:mark`);
  const levels = RECALL_RETRO.stepMarks;
  const up = Math.min(1, Math.floor((ms - at) / hold) / Math.max(1, levels - 1));
  const downAge = until - ms;
  const down = Math.min(1, Math.floor(downAge / hold) / Math.max(1, levels - 1));
  return Math.min(up, down) === 0 && ms > at && ms < until ? 1 / (levels - 1) : Math.min(up, 1);
}

export function retroCursorOn(ms: number) {
  return Math.floor(Math.max(0, ms) / RECALL_RETRO.cursorPeriod) % 2 === 0;
}

export function retroExtraBlinks(id: string) {
  return retroUnit(`${id}:blinks`) < 0.5
    ? RECALL_RETRO.cursorExtraMin
    : RECALL_RETRO.cursorExtraMax;
}

let barrelUrl = "";

export function recallBarrelMap() {
  if (barrelUrl) {
    return barrelUrl;
  }
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  const img = ctx.createImageData(size, size);
  const pix = img.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const r2 = nx * nx + ny * ny;
      const f = r2 * 0.55;
      const i = (y * size + x) * 4;
      pix[i] = Math.max(0, Math.min(255, 128 + nx * f * 127));
      pix[i + 1] = Math.max(0, Math.min(255, 128 + ny * f * 127));
      pix[i + 2] = 128;
      pix[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  barrelUrl = canvas.toDataURL("image/png");
  return barrelUrl;
}

export function retroRollY(t: number, cssH: number) {
  const band = cssH * RECALL_RETRO.rollH;
  const u = ((t % RECALL_RETRO.rollMs) + RECALL_RETRO.rollMs) % RECALL_RETRO.rollMs;
  return (u / RECALL_RETRO.rollMs) * (cssH + band) - band;
}
