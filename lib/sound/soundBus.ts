export type MotionFrame = {
  energy: number;
  x: number;
  y: number;
  speed: number;
};

export type GhostTick = {
  x: number;
  size: number;
};

export type EnterCue = "hold" | "cancel" | "flash" | "land";

type MotionListener = (frame: MotionFrame) => void;

let motionListener: MotionListener | null = null;
let engine: {
  setMotion: (frame: MotionFrame) => void;
  ghostTick: (tick: GhostTick) => void;
  enter: (cue: EnterCue) => void;
} | null = null;

export function bindSoundEngine(next: typeof engine) {
  engine = next;
}

export function onSoundMotion(listener: MotionListener | null) {
  motionListener = listener;
}

export function publishMotion(frame: MotionFrame) {
  motionListener?.(frame);
  engine?.setMotion(frame);
}

export function publishGhostTick(tick: GhostTick) {
  engine?.ghostTick(tick);
}

export function publishEnter(cue: EnterCue) {
  engine?.enter(cue);
}
