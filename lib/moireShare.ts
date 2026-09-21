export type MoireShare = {
  mouseX: number;
  mouseY: number;
  offsetX: number;
  offsetY: number;
  energy: number;
  hasPointer: boolean;
};

const frame: MoireShare = {
  mouseX: 0,
  mouseY: 0,
  offsetX: 0,
  offsetY: 0,
  energy: 0,
  hasPointer: false,
};

export function publishMoireShare(next: MoireShare) {
  frame.mouseX = next.mouseX;
  frame.mouseY = next.mouseY;
  frame.offsetX = next.offsetX;
  frame.offsetY = next.offsetY;
  frame.energy = next.energy;
  frame.hasPointer = next.hasPointer;
}

export function readMoireShare(): MoireShare {
  return frame;
}
