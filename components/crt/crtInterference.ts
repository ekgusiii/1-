import { clamp01, lerpToward } from "@/components/crt/crtAlignment";

export type InterferencePointer = {
  x: number;
  y: number;
};

export type TextFieldBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type InterferenceState = {
  ax: number;
  ay: number;
  px: number | null;
  py: number | null;
  vx: number;
  vy: number;
  speed: number;
  band: number;
  phaseA: number;
  phaseB: number;
  phaseC: number;
  travel: number;
  presence: number;
  phosphor: number;
  glow: number;
  cx: number;
  cy: number;
  fov: number;
  textX: number;
  textY: number;
  textK: number;
  textInk: number;
  textInside: number;
  guideAmount: number;
  wash: number;
  bandShiftX: number;
  bandShiftY: number;
};

export const INITIAL_INTERFERENCE: InterferenceState = {
  ax: 0.5,
  ay: 0.5,
  px: null,
  py: null,
  vx: 0,
  vy: 0,
  speed: 0,
  band: 0.42,
  phaseA: 0.2,
  phaseB: 1.1,
  phaseC: 2.4,
  travel: 0,
  presence: 0,
  phosphor: 0,
  glow: 0,
  cx: 0.5,
  cy: 0.5,
  fov: 1.1,
  textX: 0.5,
  textY: 0.5,
  textK: 0,
  textInk: 0,
  textInside: 1,
  guideAmount: 0,
  wash: 0,
  bandShiftX: 0,
  bandShiftY: 0,
};

export type InterferenceTick = {
  css: Record<string, string>;
  mouseX: number;
  mouseY: number;
  glow: number;
  fov: number;
  textPeakX: number;
  textPeakY: number;
  textBulge: number;
  textInk: number;
  textInside: number;
  holeX: number;
  holeY: number;
  guideAmount: number;
  wash: number;
  bandShiftX: number;
  bandShiftY: number;
};

function format(value: number, digits = 3) {
  return value.toFixed(digits);
}

export function tickInterference(
  state: InterferenceState,
  dt: number,
  pointer: InterferencePointer | null,
  width: number,
  height: number,
  misalign: number,
  now: number,
  locked = false,
  textBounds?: TextFieldBounds,
): InterferenceTick {
  const nx = pointer && width > 0 ? clamp01(pointer.x / width) : state.ax;
  const ny = pointer && height > 0 ? clamp01(pointer.y / height) : state.ay;

  state.ax = lerpToward(state.ax, nx, dt, 0.08);
  state.ay = lerpToward(state.ay, ny, dt, 0.08);
  state.cx = lerpToward(state.cx, nx, dt, 0.05);
  state.cy = lerpToward(state.cy, ny, dt, 0.05);
  state.band = lerpToward(state.band, ny, dt, 0.72);

  if (pointer && state.px != null && state.py != null) {
    const instX = (pointer.x - state.px) / Math.max(dt, 0.001);
    const instY = (pointer.y - state.py) / Math.max(dt, 0.001);
    state.vx = lerpToward(state.vx, instX, dt, 0.09);
    state.vy = lerpToward(state.vy, instY, dt, 0.09);

    const dist = Math.hypot(pointer.x - state.px, pointer.y - state.py);
    if (dist > 0.45 && width > 0 && height > 0) {
      const span = Math.hypot(width, height) * 2.7;
      state.travel = clamp01(state.travel + dist / span);
    }
  } else {
    state.vx = lerpToward(state.vx, 0, dt, 0.18);
    state.vy = lerpToward(state.vy, 0, dt, 0.18);
  }

  if (pointer) {
    state.px = pointer.x;
    state.py = pointer.y;
  }

  const speed = clamp01(Math.hypot(state.vx, state.vy) / 1500);
  state.speed = lerpToward(state.speed, speed, dt, 0.12);

  const m = misalign;
  const t = now / 1000;
  state.phaseA += dt * (0.07 + m * 0.28 + state.speed * 0.35);
  state.phaseB += dt * (0.045 + m * 0.19) - state.speed * dt * 0.22;
  state.phaseC += dt * (0.11 + m * 0.42) + state.speed * dt * 1.15;

  const sinA = Math.sin(state.phaseA);
  const cosA = Math.cos(state.phaseA);
  const sinB = Math.sin(state.phaseB * 1.31 + 0.6);
  const cosB = Math.cos(state.phaseB * 0.87);
  const sinC = Math.sin(state.phaseC * 0.79 + 1.4);
  const cosC = Math.cos(state.phaseC * 1.17);

  const dx = state.ax - 0.5;
  const dy = state.ay - 0.5;

  const iaX = (dx * 5.4 + sinA * 1.8) * m;
  const iaY = (dy * 7.2 + cosA * 2.4 + Math.sin(t * 0.13) * 1.2) * m;
  const ibX = (-dx * 2.8 + cosB * 1.4) * m;
  const ibY = (-dy * 2.1 + sinB * 3.6 + Math.cos(t * 0.09) * 1.6) * m;
  const icX = (state.vx * 0.004 + sinC * 2.2) * m;
  const icY = (-state.vy * 0.003 + cosC * 1.7) * m;

  const bandY =
    (state.band - 0.5) * 18 * m +
    Math.sin(t * 0.11 + state.phaseA * 0.2) * 14 * m +
    12;
  const warpX = (sinB * 10 + dx * 6) * m;
  const warpY = (cosA * 8 + Math.sin(t * 0.08) * 5) * m;
  const rgb = m * (0.1 + state.speed * 0.9);
  const iaSkew = (sinA * 0.55 + dy * 0.2) * m;
  const ibSkew = (cosB * -0.4 + state.speed * 0.15) * m;
  const icSkew = sinC * 0.28 * m;
  const iaRot = (0.42 + sinA * 0.12) * m;
  const ibRot = (-0.28 + cosB * 0.1) * m;
  const icRot = (0.18 + sinC * 0.08) * m;
  const iaTx = (dx * 1.35 + sinA * 0.4) * m;
  const iaTy = (dy * 1.1 + cosA * 0.35) * m;
  const ibTx = (-dx * 0.7 + cosB * 0.25) * m;
  const ibTy = (-dy * 0.55 + sinB * 0.4) * m;
  const icTx = (state.vx * 0.0012 + sinC * 0.3) * m;
  const icTy = (-state.vy * 0.001 + cosC * 0.22) * m;

  if (state.travel > 0.0006 || state.speed > 0.045) {
    state.presence = lerpToward(state.presence, 1, dt, 0.95);
  }

  let phosphorTarget = clamp01(
    state.presence * 0.22 + state.travel * 0.82 + state.speed * 0.08,
  );
  if (locked) {
    phosphorTarget = Math.max(phosphorTarget, 0.9);
  }
  state.phosphor = lerpToward(state.phosphor, phosphorTarget, dt, 0.64);

  if (state.speed > 0.04) {
    const glowTarget = clamp01(state.speed * 1.5);
    state.glow = Math.max(
      state.glow,
      lerpToward(state.glow, glowTarget, dt, 0.07),
    );
  } else {
    state.glow *= Math.pow(0.9, dt * 60);
    if (state.glow < 0.002) {
      state.glow = 0;
    }
  }

  if (state.speed > 0.04) {
    state.wash = lerpToward(state.wash, 1, dt, 0.12);
  } else {
    state.wash *= Math.exp(-dt / 0.33);
    if (state.wash < 0.002) {
      state.wash = 0;
    }
  }

  const shiftX = Math.max(-0.1, Math.min(0.1, state.vx / 1600)) * state.wash;
  const shiftY = Math.max(-0.1, Math.min(0.1, state.vy / 1600)) * state.wash;
  state.bandShiftX = lerpToward(state.bandShiftX, shiftX, dt, 0.22);
  state.bandShiftY = lerpToward(state.bandShiftY, shiftY, dt, 0.22);

  state.fov = lerpToward(state.fov, 1.1 + state.glow * 0.15, dt, 0.38);

  let targetK = 0;
  if (!locked && pointer && state.speed > 0.035) {
    targetK = 1;
  }
  state.textX = lerpToward(state.textX, nx, dt, 0.1);
  state.textY = lerpToward(state.textY, ny, dt, 0.1);
  state.textK = lerpToward(state.textK, targetK, dt, 0.1);
  if (state.textK < 0.002 && targetK < 0.002) {
    state.textK = 0;
  }
  const inkTime = state.glow >= state.textInk ? 0.22 : 0.35;
  state.textInk = lerpToward(state.textInk, state.glow, dt, inkTime);
  if (state.textInk < 0.002 && state.glow < 0.002) {
    state.textInk = 0;
  }

  let insideTarget = 0;
  if (!locked && pointer && width > 0 && height > 0) {
    const aspect = width / height;
    const sphereR = Math.hypot((nx - 0.5) * aspect, ny - 0.5);
    const t = clamp01((sphereR - 0.4) / 0.1);
    insideTarget = 1 - t * t * (3 - 2 * t);
  }
  state.textInside = lerpToward(state.textInside, insideTarget, dt, 0.4);

  let guideTarget = 0;
  if (!locked && pointer && width > 0 && height > 0) {
    const aspect = width / height;
    const sphereR = Math.hypot((nx - 0.5) * aspect, ny - 0.5);
    const prox = clamp01(1 - sphereR / 0.48);
    guideTarget = prox * state.glow;
  }
  const guideTau = state.guideAmount > guideTarget ? 0.55 : 0.14;
  state.guideAmount = lerpToward(state.guideAmount, guideTarget, dt, guideTau);
  if (state.guideAmount < 0.002 && guideTarget < 0.002) {
    state.guideAmount = 0;
  }

  const flicker =
    (Math.sin(t * 0.21 + state.phaseA * 0.12) * 0.55 +
      Math.sin(t * 0.39 + 0.8) * 0.45) *
    Math.max(state.phosphor, state.glow);

  return {
    css: {
      "--ix": format(state.ax, 4),
      "--iy": format(state.ay, 4),
      "--speed": format(state.speed, 4),
      "--band-y": `${format(bandY, 2)}%`,
      "--ia-x": `${format(iaX, 2)}%`,
      "--ia-y": `${format(iaY, 2)}%`,
      "--ib-x": `${format(ibX, 2)}%`,
      "--ib-y": `${format(ibY, 2)}%`,
      "--ic-x": `${format(icX, 2)}%`,
      "--ic-y": `${format(icY, 2)}%`,
      "--ia-tx": `${format(iaTx, 2)}%`,
      "--ia-ty": `${format(iaTy, 2)}%`,
      "--ib-tx": `${format(ibTx, 2)}%`,
      "--ib-ty": `${format(ibTy, 2)}%`,
      "--ic-tx": `${format(icTx, 2)}%`,
      "--ic-ty": `${format(icTy, 2)}%`,
      "--ia-skew": `${format(iaSkew, 3)}deg`,
      "--ib-skew": `${format(ibSkew, 3)}deg`,
      "--ic-skew": `${format(icSkew, 3)}deg`,
      "--ia-rot": `${format(iaRot, 3)}deg`,
      "--ib-rot": `${format(ibRot, 3)}deg`,
      "--ic-rot": `${format(icRot, 3)}deg`,
      "--warp-x": `${format(warpX, 2)}%`,
      "--warp-y": `${format(warpY, 2)}%`,
      "--rgb": format(rgb, 4),
      "--noise-x": `${format(sinA * 0.35 * m, 3)}%`,
      "--noise-y": `${format(cosC * 0.28 * m, 3)}%`,
      "--phosphor": format(Math.max(state.phosphor, state.glow), 4),
      "--phos-flicker": format(flicker, 4),
    },
    mouseX: state.cx,
    mouseY: state.cy,
    glow: state.glow,
    fov: state.fov,
    textPeakX: state.textX,
    textPeakY: 1 - state.textY,
    textBulge: clamp01(state.textK),
    textInk: clamp01(state.textInk),
    textInside: clamp01(state.textInside),
    holeX: state.ax,
    holeY: state.ay,
    guideAmount: clamp01(state.guideAmount),
    wash: clamp01(state.wash),
    bandShiftX: state.bandShiftX,
    bandShiftY: state.bandShiftY,
  };
}
