export const RECALL_MATTER = {
  pale: "#e6f0ff",
  amber: "rgb(176, 162, 42)",
  glowInnerPx: 3,
  glowInner: "rgba(220, 235, 255, 0.8)",
  glowOuterPx: 14,
  glowOuter: "rgba(170, 200, 255, 0.35)",
  glowRefSize: 36,
  glyphBlurMin: 0.4,
  glyphBlurMax: 0.6,
  pink: "rgb(255, 150, 188)",
  cyan: "rgb(130, 220, 255)",
  registerPx: 1,
  registerAlpha: 0.25,
  bloomInMark: 0.42,
  bloomOut: 1,
  fieldDeep: "#1c2a78",
  fieldMid: "#22317f",
  fieldCenter: "#2a3a92",
  vignetteMin: 0.25,
  vignetteMax: 0.35,
  grainMin: 0.04,
  grainMax: 0.06,
  grainSpeed: 0.012,
  grainTile: 96,
  scanAlpha: 0.12,
  scanStepCss: 2,
  flickerMin: 0.97,
  flickerMax: 1,
  hitchPx: 1,
  hitchMs: 70,
  hitchGapMin: 3000,
  hitchGapMax: 5000,
  hitchFirst: 1800,
  markFill: "#070b24",
  markBlur: 0.5,
  markInset: "inset 0 0 14px rgba(170, 200, 255, 0.18)",
} as const;

function hash32(seed: number) {
  let h = seed | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function recallSizeScale(size: number) {
  return Math.max(0.55, size / RECALL_MATTER.glowRefSize);
}

export function recallGlyphBlur(size: number) {
  const t = Math.min(1, recallSizeScale(size) * 0.55);
  return (
    RECALL_MATTER.glyphBlurMin +
    (RECALL_MATTER.glyphBlurMax - RECALL_MATTER.glyphBlurMin) * t
  );
}

export function recallGlow(size: number, boxed: boolean) {
  const s = recallSizeScale(size);
  const cut = boxed ? RECALL_MATTER.bloomInMark : RECALL_MATTER.bloomOut;
  return {
    inner: RECALL_MATTER.glowInnerPx * s,
    outer: RECALL_MATTER.glowOuterPx * s * cut,
    innerA: boxed ? 0.45 : 0.8,
    outerA: boxed ? 0.14 : 0.35,
  };
}

export function recallFlicker(t: number) {
  const a = Math.sin(t * 0.00092);
  const b = Math.sin(t * 0.00031 + 1.4);
  const c = Math.sin(t * 0.0017 + 0.6);
  const u = Math.min(1, Math.max(0, 0.5 + 0.42 * a * b + 0.1 * c));
  return (
    RECALL_MATTER.flickerMin +
    (RECALL_MATTER.flickerMax - RECALL_MATTER.flickerMin) * u
  );
}

export function recallHitchY(t: number) {
  if (t < 0) {
    return 0;
  }
  let at = RECALL_MATTER.hitchFirst;
  let i = 0;
  while (at < t + RECALL_MATTER.hitchMs && i < 32) {
    if (t >= at && t < at + RECALL_MATTER.hitchMs) {
      return RECALL_MATTER.hitchPx;
    }
    const gap =
      RECALL_MATTER.hitchGapMin +
      hash32(i + 17) * (RECALL_MATTER.hitchGapMax - RECALL_MATTER.hitchGapMin);
    at += gap;
    i += 1;
  }
  return 0;
}

export function recallGrainAlpha(t: number) {
  const u = 0.5 + 0.5 * Math.sin(t * 0.00045);
  return (
    RECALL_MATTER.grainMin +
    (RECALL_MATTER.grainMax - RECALL_MATTER.grainMin) * u
  );
}

export function recallVignette(t: number) {
  const u = 0.5 + 0.5 * Math.sin(t * 0.00028 + 0.8);
  return (
    RECALL_MATTER.vignetteMin +
    (RECALL_MATTER.vignetteMax - RECALL_MATTER.vignetteMin) * u
  );
}

export function recallGlowFilter(size: number, boxed: boolean) {
  const glow = recallGlow(size, boxed);
  return `drop-shadow(0 0 ${glow.inner.toFixed(1)}px rgba(220,235,255,${glow.innerA})) drop-shadow(0 0 ${glow.outer.toFixed(1)}px rgba(170,200,255,${glow.outerA}))`;
}
