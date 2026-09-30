import {ARCHIVE, mulberry32, randRange} from "@/components/archive/archiveConfig";
import {sessionSeed as itemSeed, type ArchiveItem} from "@/components/archive/archiveItems";

export type SpawnEvent = {
  id: string;
  appearAt: number;
  slideMs: number;
  fromVh: number;
};

function slideOf(rng: () => number) {
  return {
    slideMs: Math.round(randRange(rng, ARCHIVE.slideMsMin, ARCHIVE.slideMsMax)),
    fromVh: randRange(rng, ARCHIVE.slideFromVhMin, ARCHIVE.slideFromVhMax),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function randGaussian(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }
  const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
  return clamp(n, -2.2, 2.2);
}

export function buildSpawnPlan(items: ArchiveItem[]): SpawnEvent[] {
  const rng = mulberry32(itemSeed() ^ 0x51a2);
  const ordered = [...items].sort((a, b) => a.y - b.y);
  const plan: SpawnEvent[] = [];
  let t = 0;
  for (const item of ordered) {
    plan.push({
      id: item.id,
      appearAt: Math.round(t),
      ...slideOf(rng),
    });
    t += randRange(rng, ARCHIVE.spawnGapMin, ARCHIVE.spawnGapMax);
  }
  for (const event of plan) {
    const jitter = clamp(randGaussian(rng) * 28, -55, 55);
    event.appearAt = Math.max(0, Math.round(event.appearAt + jitter));
  }
  return plan;
}
