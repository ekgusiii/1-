import {ARCHIVE, mulberry32, randInt, randRange} from "@/components/archive/archiveConfig";
import {sessionSeed as itemSeed, type ArchiveItem} from "@/components/archive/archiveItems";

export type SpawnEvent = {
  id: string;
  appearAt: number;
  slideMs: number;
  fromVh: number;
};

function jitter(rng: () => number, ms: number) {
  return ms * randRange(rng, 0.8, 1.2);
}

function slideOf(rng: () => number) {
  return {
    slideMs: Math.round(randRange(rng, ARCHIVE.slideMsMin, ARCHIVE.slideMsMax)),
    fromVh: randRange(rng, ARCHIVE.slideFromVhMin, ARCHIVE.slideFromVhMax),
  };
}

export function buildSpawnPlan(items: ArchiveItem[]): SpawnEvent[] {
  const rng = mulberry32(itemSeed() ^ 0x51a2);
  const plan: SpawnEvent[] = [];
  let t = 0;
  let i = 0;

  const first = items[0];
  if (first) {
    plan.push({id: first.id, appearAt: t, ...slideOf(rng)});
    i = 1;
  }

  for (const gap of ARCHIVE.spawnSlow) {
    const item = items[i];
    if (!item) {
      break;
    }
    t += jitter(rng, gap);
    plan.push({id: item.id, appearAt: t, ...slideOf(rng)});
    i += 1;
  }

  for (const gap of ARCHIVE.spawnAccel) {
    const item = items[i];
    if (!item) {
      break;
    }
    t += jitter(rng, gap);
    plan.push({id: item.id, appearAt: t, ...slideOf(rng)});
    i += 1;
  }

  const left = items.slice(i);
  while (left.length) {
    t += jitter(rng, randRange(rng, ARCHIVE.spawnBurstGap[0], ARCHIVE.spawnBurstGap[1]));
    const take = Math.min(
      left.length,
      randInt(rng, ARCHIVE.spawnBurstMin, ARCHIVE.spawnBurstMax),
    );
    const chunk = left.splice(0, take);
    chunk.forEach((item, index) => {
      const extra =
        index === 0
          ? 0
          : jitter(
              rng,
              randRange(rng, ARCHIVE.spawnBurstJitter[0], ARCHIVE.spawnBurstJitter[1]),
            );
      plan.push({
        id: item.id,
        appearAt: t + extra,
        ...slideOf(rng),
      });
    });
  }

  return plan;
}
