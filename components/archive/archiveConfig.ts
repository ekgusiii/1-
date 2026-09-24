export const ARCHIVE = {
  moireMs: 400,
  hushMs: 900,
  hushQuietMs: 400,
  glitchMs: 500,
  signalHoldMs: 1000,
  skyMs: 300,
  reducedGlitchMs: 220,
  squeezeStart: 0.86,
  bandMin: 8,
  bandMax: 14,
  bandShiftMin: 10,
  bandShiftMax: 60,
  reshuffleMinMs: 60,
  reshuffleMaxMs: 90,
  rgbMin: 3,
  rgbMax: 12,
  rollPx: 34,
  rollAt: 0.38,
  dropAt: 0.64,
  dropMs: 50,
  barrelK: 0.12,
  signalBuffer: 0.5,
  signalCanvas: false,
  backgroundVideo: "",
  skyBuffer: 0.5,
  skySat: 0.48,
  windowDelay: 1000,
  slideFromVhMin: 160,
  slideFromVhMax: 200,
  slideMsMin: 1200,
  slideMsMax: 1800,
  slideFadeUntil: 0.15,
  slideStiffness: 120,
  slideDamping: 18,
  slideMass: 1,
  slideBlurMax: 6,
  slideSettleShakePx: 1,
  slideSettleShakeMs: 180,
  slideEase: "cubic-bezier(0.12, 0.7, 0.16, 1)",
  spawnGapMin: 60,
  spawnGapMax: 150,
  tiltAngle: 36,
  planeTilt: 4,
  planeShiftY: 0,
  tiltXJitter: 4,
  tiltZJitter: 2,
  tiltPerspective: 1200,
  standDwellMs: 400,
  standMs: 450,
  standScale: 1.6,
  standPad: 24,
  layMs: 350,
  infoDwellMs: 600,
  infoWidth: 320,
  infoEdge: 16,
  infoOpenMs: 500,
  infoOpenEase: "cubic-bezier(0.22, 1, 0.36, 1)",
  infoBarPadX: 12,
  infoCloseMs: 300,
  infoCloseEase: "cubic-bezier(0.4, 0, 1, 1)",
  infoTextDelay: 250,
  infoTextStagger: 60,
  infoTextLift: 6,
  infoLeaveGraceMs: 40,
  autoLayMs: 700,
  autoLayMoveMs: 550,
  autoLayEase: "cubic-bezier(0.22, 1, 0.36, 1)",
  videoCueAt: 0.2,
  clipLayoutW: 1440,
  clipLayoutH: 900,
  clipNearPadPx: 16,
  clipCueMin: 0.06,
  clipCueMax: 0.88,
  clipCueJitter: 0.06,
  videoViewMargin: 0.12,
  trailerMoveChance: 0.3,
  trailerStillMsMin: 500,
  trailerStillMsMax: 900,
  trailerMoveMsMin: 1000,
  trailerMoveMsMax: 1500,
  trailerStoryStart: 0.06,
  trailerStoryStepMin: 0.07,
  trailerStoryStepMax: 0.14,
  trailerStoryJitter: 0.03,
  trailerCutMs: 32,
  tuneApproachPx: 300,
  tuneApproachScale: 1.03,
  tuneApproachZ: 18,
  tuneIdleBlur: 0.35,
  tuneIdleOpacity: 0.92,
  tuneIdleContrast: 0.94,
  tuneIdleSat: 0.9,
  tuneIdleRgb: 1.6,
  tuneIdleNoise: 0.1,
  tuneActiveContrast: 1.06,
  tuneBgNearBlur: 1,
  tuneBgNearOpacity: 0.72,
  tuneBgMidBlur: 2,
  tuneBgMidOpacity: 0.55,
  tuneBgFarBlur: 3,
  tuneBgFarOpacity: 0.42,
  tuneLockMs: 72,
  tuneLockShiftMin: 1,
  tuneLockShiftMax: 2,
  tuneStaggerMs: 26,
  winCountMin: 18,
  winCountMax: 24,
  lockEarlyMs: 400,
  lockLateMs: 80,
  spawnSlow: [500, 350, 250],
  spawnAccel: [150, 100, 70, 50],
  spawnBurstMin: 3,
  spawnBurstMax: 6,
  spawnBurstGap: [40, 60],
  spawnBurstJitter: [10, 20],
  videoK: 0.012,
  videoNear: 0.62,
  videoMaxActive: 6,
  focusHysteresis: 0.15,
  focusStillSpeed: 0.02,
  focusGainMs: 150,
  focusLoseMsMin: 400,
  focusLoseMsMax: 600,
  focusRgbPx: 4,
  focusNoiseMin: 0.04,
  focusScan: 0.07,
  focusBandNear: 0.28,
  focusBandMid: 0.58,
  focusNearBlur: 1,
  focusMidSaturate: 0.5,
  focusNearNoise: 0.14,
  focusMidNoise: 0.34,
  focusFarNoise: 0.62,
  focusMaxNoise: 0.78,
  focusFarJitterMin: 2,
  focusFarJitterMax: 4,
  focusFarScan: 0.26,
  focusFilterMax: 4,
  focusNosignalMinLoss: 0.78,
  focusNosignalDurMin: 100,
  focusNosignalDurMax: 300,
  focusNosignalGapMin: 3000,
  focusNosignalGapMax: 8000,
} as const;

export type ArchivePhase = "moire" | "hush" | "glitch" | "sky" | "signal";

export function archivePhaseAt(ms: number, reducedMotion: boolean): ArchivePhase {
  const glitchMs = reducedMotion ? ARCHIVE.reducedGlitchMs : ARCHIVE.glitchMs;
  if (ms < ARCHIVE.moireMs) {
    return "moire";
  }
  if (ms < ARCHIVE.moireMs + ARCHIVE.hushMs) {
    return "hush";
  }
  if (ms < ARCHIVE.moireMs + ARCHIVE.hushMs + glitchMs) {
    return "glitch";
  }
  if (ms < ARCHIVE.moireMs + ARCHIVE.hushMs + glitchMs + ARCHIVE.skyMs) {
    return "sky";
  }
  return "signal";
}

export function archiveLocalT(
  ms: number,
  phase: ArchivePhase,
  reducedMotion: boolean,
) {
  const glitchMs = reducedMotion ? ARCHIVE.reducedGlitchMs : ARCHIVE.glitchMs;
  if (phase === "moire") {
    return ms / ARCHIVE.moireMs;
  }
  if (phase === "hush") {
    return (ms - ARCHIVE.moireMs) / ARCHIVE.hushMs;
  }
  if (phase === "glitch") {
    return (ms - ARCHIVE.moireMs - ARCHIVE.hushMs) / glitchMs;
  }
  if (phase === "sky") {
    return (ms - ARCHIVE.moireMs - ARCHIVE.hushMs - glitchMs) / ARCHIVE.skyMs;
  }
  return (
    (ms - ARCHIVE.moireMs - ARCHIVE.hushMs - glitchMs - ARCHIVE.skyMs) /
    ARCHIVE.signalHoldMs
  );
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: () => number, min: number, max: number) {
  return min + (max - min) * rng();
}

export function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(randRange(rng, min, max + 1));
}
