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
  return plan;
}
