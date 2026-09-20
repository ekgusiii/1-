import { clamp01 } from "@/components/crt/crtAlignment";

export const ENTER_RADIUS = 0.06;
export const DWELL_TIME = 0.4;
export const APPROACH_END = 0.4;
export const SURGE_END = 0.75;
export const ENTER_END = 1.05;

export type EnterPhase = "idle" | "dwell" | "inhale" | "surge" | "land";

export type EnterState = {
  phase: EnterPhase;
  dwell: number;
  t: number;
};

export const INITIAL_ENTER: EnterState = {
  phase: "idle",
  dwell: 0,
  t: 0,
};

export type EnterVisuals = {
  guideScale: number;
  canvasScale: number;
  holeLock: number;
  holeExpand: number;
  holeHold: number;
  scatter: number;
  dim: number;
  flash: number;
  scan: number;
  blur: number;
  ca: number;
  noiseSlow: number;
};

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeInExpo(t: number) {
  return t <= 0 ? 0 : Math.pow(2, 10 * t - 10);
}

function easeOutQuart(t: number) {
  return 1 - (1 - t) ** 4;
}

export function inEnterZone(nx: number, ny: number) {
  return Math.hypot(nx - 0.5, ny - 0.5) <= ENTER_RADIUS;
}

export function enterVisuals(t: number, foreshadow: number): EnterVisuals {
  const fs = clamp01(foreshadow);
  const time = Math.max(0, t);
  const approachU = clamp01(time / APPROACH_END);
  const approachE = easeInOutSine(approachU);

  let guideScale = mix(0.85, 0.9, approachE);
  let canvasScale = mix(1, 1.04, approachE);
  let holeLock = time > 0 ? 1 : 0;
  let holeExpand = mix(0, 0.28, approachE);
  let holeHold = mix(fs, 1, approachE);
  let scatter = 0;
  let dim = 0;
  let flash = 0;
  let scan = 0;
  let blur = 0;
  let ca = 0;
  let noiseSlow = 0;

  if (time > APPROACH_END) {
    const surgeU = clamp01((time - APPROACH_END) / (SURGE_END - APPROACH_END));
    const surgeE = easeInExpo(surgeU);
    guideScale = mix(0.9, 1.1, surgeE);
    canvasScale = mix(1.04, 1.8, surgeE);
    holeExpand = mix(0.28, 1, surgeE);
    holeHold = 1;
    scatter = 0;
    blur = surgeE;
    ca = surgeU > 0.72 ? easeInExpo((surgeU - 0.72) / 0.28) : surgeE * 0.15;
    noiseSlow = 0;
  }

  if (time > SURGE_END) {
    const landU = clamp01((time - SURGE_END) / (ENTER_END - SURGE_END));
    const landE = easeOutQuart(landU);
    guideScale = mix(1.1, 1, landE);
    canvasScale = 1.8;
    holeExpand = 1;
    holeHold = 1;
    scatter = 0;
    dim = 0;
    flash = 0;
    scan = 0;
    blur = 0;
    ca = 0;
    noiseSlow = 0;
  }

  return {
    guideScale,
    canvasScale,
    holeLock,
    holeExpand,
    holeHold,
    scatter,
    dim,
    flash,
    scan,
    blur,
    ca,
    noiseSlow,
  };
}

export function tickEnter(
  state: EnterState,
  dt: number,
  inZone: boolean,
  hasPrograms: boolean,
): {finished: boolean; visuals: EnterVisuals} {
  let finished = false;

  if (!hasPrograms) {
    state.phase = "idle";
    state.dwell = 0;
    state.t = 0;
    return {finished, visuals: enterVisuals(0, 0)};
  }

  if (state.phase === "idle") {
    if (inZone) {
      state.phase = "dwell";
      state.dwell = dt;
    }
  } else if (state.phase === "dwell") {
    if (!inZone) {
      state.phase = "idle";
      state.dwell = 0;
    } else {
      state.dwell += dt;
      if (state.dwell >= DWELL_TIME) {
        state.phase = "inhale";
        state.t = 0;
      }
    }
  } else if (state.phase === "inhale") {
    if (!inZone) {
      state.t -= dt * 1.35;
      if (state.t <= 0) {
        state.t = 0;
        state.phase = "idle";
        state.dwell = 0;
      }
    } else {
      state.t += dt;
      if (state.t >= APPROACH_END) {
        state.phase = "surge";
      }
    }
  } else if (state.phase === "surge") {
    state.t += dt;
    if (state.t >= SURGE_END) {
      state.phase = "land";
    }
  } else if (state.phase === "land") {
    state.t += dt;
    if (state.t >= ENTER_END) {
      state.t = ENTER_END;
      finished = true;
    }
  }

  const foreshadow =
    state.phase === "dwell"
      ? clamp01(state.dwell / DWELL_TIME)
      : state.phase === "idle"
        ? 0
        : 1;

  return {finished, visuals: enterVisuals(state.t, foreshadow)};
}
