export type MoireShare = {
  mouseX: number;
  mouseY: number;
  offsetX: number;
  offsetY: number;
  energy: number;
  hasPointer: boolean;
  timeScale: number;
  interact: boolean;
  scanBoost: number;
  hideText: boolean;
};

const frame: MoireShare = {
  mouseX: 0,
  mouseY: 0,
  offsetX: 0,
  offsetY: 0,
  energy: 0,
  hasPointer: false,
  timeScale: 1,
  interact: true,
  scanBoost: 0,
  hideText: false,
};

export function publishMoireShare(
  next: Pick<
    MoireShare,
    "mouseX" | "mouseY" | "offsetX" | "offsetY" | "energy" | "hasPointer"
  >,
) {
  frame.mouseX = next.mouseX;
  frame.mouseY = next.mouseY;
  frame.offsetX = next.offsetX;
  frame.offsetY = next.offsetY;
  frame.energy = next.energy;
  frame.hasPointer = next.hasPointer;
}

export function publishTransitShare(
  next: Partial<
    Pick<MoireShare, "timeScale" | "interact" | "scanBoost" | "hideText">
  >,
) {
  if (next.timeScale !== undefined) {
    frame.timeScale = next.timeScale;
  }
  if (next.interact !== undefined) {
    frame.interact = next.interact;
  }
  if (next.scanBoost !== undefined) {
    frame.scanBoost = next.scanBoost;
  }
  if (next.hideText !== undefined) {
    frame.hideText = next.hideText;
  }
}

export function readMoireShare(): MoireShare {
  return frame;
}
