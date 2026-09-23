import {ARCHIVE} from "@/components/archive/archiveConfig";

export type FocusTarget = {
  id: string;
  x: number;
  y: number;
  project: boolean;
};

export type SignalState = {
  loss: number;
  loseMs: number;
  lockUntil: number;
  nosignalUntil: number;
  nextNosignal: number;
};

export function hashId(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeSignal(id: string, now: number): SignalState {
  const loseU = (hashId(`${id}:lose`) % 10000) / 10000;
  const gapU = (hashId(`${id}:gap0`) % 10000) / 10000;
  return {
    loss: 0,
    loseMs:
      ARCHIVE.focusLoseMsMin + (ARCHIVE.focusLoseMsMax - ARCHIVE.focusLoseMsMin) * loseU,
    lockUntil: 0,
    nosignalUntil: 0,
    nextNosignal:
      now +
      ARCHIVE.focusNosignalGapMin +
      (ARCHIVE.focusNosignalGapMax - ARCHIVE.focusNosignalGapMin) * gapU,
  };
}

export function pickFocus(
  targets: FocusTarget[],
  cursor: {x: number; y: number; speed: number},
  currentId: string | null,
  still: boolean,
): {id: string | null; dist: number} {
  const projects = targets.filter((item) => item.project);
  if (!projects.length) {
    return {id: null, dist: Infinity};
  }
  const ranked = projects
    .map((item) => ({
      id: item.id,
      dist: Math.hypot(cursor.x - item.x, cursor.y - item.y),
    }))
    .sort((a, b) => a.dist - b.dist);
  const nearest = ranked[0];
  if (!nearest) {
    return {id: null, dist: Infinity};
  }
  if (!currentId) {
    return nearest;
  }
  if (still || cursor.speed < ARCHIVE.focusStillSpeed) {
    const current = ranked.find((item) => item.id === currentId);
    return current ?? nearest;
  }
  const current = ranked.find((item) => item.id === currentId);
  if (!current) {
    return nearest;
  }
  if (nearest.id === currentId) {
    return nearest;
  }
  if (nearest.dist < current.dist * (1 - ARCHIVE.focusHysteresis)) {
    return nearest;
  }
  return current;
}

export function lossFromRank(index: number, count: number) {
  if (count <= 1) {
    return 0;
  }
  return index / (count - 1);
}

export function mixSignal(loss: number) {
  const near = ARCHIVE.focusBandNear;
  const mid = ARCHIVE.focusBandMid;
  let blur = 0;
  let sat = 1;
  let noise = ARCHIVE.focusNoiseMin;
  let jitter = 0;
  let scan = ARCHIVE.focusScan;
  if (loss <= 0.001) {
    return {blur, sat, noise, jitter, scan};
  }
  if (loss < near) {
    const u = loss / near;
    blur = ARCHIVE.focusNearBlur * u;
    noise = ARCHIVE.focusNoiseMin + (ARCHIVE.focusNearNoise - ARCHIVE.focusNoiseMin) * u;
    scan = ARCHIVE.focusScan + (0.14 - ARCHIVE.focusScan) * u;
    return {blur, sat, noise, jitter, scan};
  }
  if (loss < mid) {
    const u = (loss - near) / (mid - near);
    blur = ARCHIVE.focusNearBlur;
    sat = 1 - (1 - ARCHIVE.focusMidSaturate) * u;
    noise = ARCHIVE.focusNearNoise + (ARCHIVE.focusMidNoise - ARCHIVE.focusNearNoise) * u;
    scan = 0.14 + (0.2 - 0.14) * u;
    return {blur, sat, noise, jitter, scan};
  }
  const u = (loss - mid) / Math.max(0.001, 1 - mid);
  blur = ARCHIVE.focusNearBlur;
  sat = ARCHIVE.focusMidSaturate;
  noise = ARCHIVE.focusMidNoise + (ARCHIVE.focusMaxNoise - ARCHIVE.focusMidNoise) * u;
  jitter =
    ARCHIVE.focusFarJitterMin +
    (ARCHIVE.focusFarJitterMax - ARCHIVE.focusFarJitterMin) * u;
  scan = 0.2 + (ARCHIVE.focusFarScan - 0.2) * u;
  return {blur, sat, noise, jitter, scan};
}

export function tickLoss(
  state: SignalState,
  target: number,
  dt: number,
  now: number,
  isFocus: boolean,
) {
  const tau = target < state.loss - 0.001 ? ARCHIVE.focusGainMs : state.loseMs;
  const k = 1 - Math.exp(-dt / Math.max(16, tau));
  state.loss += (target - state.loss) * k;
  if (isFocus) {
    state.nosignalUntil = 0;
    return;
  }
  if (state.loss < ARCHIVE.focusNosignalMinLoss) {
    state.nosignalUntil = 0;
    return;
  }
  if (now >= state.nextNosignal) {
    const span =
      ARCHIVE.focusNosignalDurMin +
      ((hashId(`${state.nextNosignal}`) % 1000) / 1000) *
        (ARCHIVE.focusNosignalDurMax - ARCHIVE.focusNosignalDurMin);
    state.nosignalUntil = now + span;
    const gap =
      ARCHIVE.focusNosignalGapMin +
      ((hashId(`${state.nextNosignal}:gap`) % 1000) / 1000) *
        (ARCHIVE.focusNosignalGapMax - ARCHIVE.focusNosignalGapMin);
    state.nextNosignal = now + span + gap;
  }
}

export function isNosignal(state: SignalState, now: number) {
  return now < state.nosignalUntil;
}
