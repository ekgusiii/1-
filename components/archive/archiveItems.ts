import {ARCHIVE, mulberry32, randInt, randRange} from "@/components/archive/archiveConfig";
import type {Project} from "@/sanity/lib/queries";

export type ArchiveKind = "project" | "noise" | "crop" | "bar";

export type ArchiveItem = {
  id: string;
  slug: string;
  title: string;
  projectTitle: string | null;
  year: number | null;
  category: string | null;
  shortDescription: string | null;
  description: string | null;
  filename: string | null;
  role: string | null;
  tools: string | null;
  client: string | null;
  order: number | null;
  image: string | null;
  video: string | null;
  images: string[];
  videos: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ArchiveKind;
  clipIndex: number | null;
  cueAt: number;
  clickable: boolean;
  crop: string;
  residual: number;
  tiltX: number;
  tiltZ: number;
};

type ArchiveClip = {
  id: string;
  url: string;
  slug: string;
  title: string;
  year: number | null;
  category: string | null;
  shortDescription: string | null;
  description: string | null;
  filename: string | null;
  role: string | null;
  tools: string | null;
  client: string | null;
  order: number | null;
  image: string | null;
  images: string[];
  videos: string[];
  clipIndex: number;
};

const SEED_KEY = "archive-win-seed";

export function sessionSeed() {
  if (typeof window === "undefined") {
    return 1;
  }
  const existing = window.sessionStorage.getItem(SEED_KEY);
  if (existing) {
    return Number(existing);
  }
  const seed = Date.now() & 0xffff;
  window.sessionStorage.setItem(SEED_KEY, String(seed));
  return seed;
}

function urls(
  items: Array<{asset?: {url?: string | null} | null} | null> | null | undefined,
) {
  return (items ?? [])
    .map((item) => item?.asset?.url)
    .filter((url): url is string => Boolean(url));
}

function tiltOf(rng: () => number) {
  return {
    tiltX: ARCHIVE.tiltAngle + randRange(rng, -ARCHIVE.tiltXJitter, ARCHIVE.tiltXJitter),
    tiltZ: randRange(rng, -ARCHIVE.tiltZJitter, ARCHIVE.tiltZJitter),
  };
}

function scatter(rng: () => number) {
  const w = randRange(rng, 200, 400);
  const h = w * randRange(rng, 0.55, 0.95);
  return {
    w,
    h,
    x: randRange(rng, 3, 78),
    y: randRange(rng, 4, 68),
  };
}

function shuffle<T>(list: T[], rng: () => number) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = list[i];
    const b = list[j];
    if (a && b) {
      list[i] = b;
      list[j] = a;
    }
  }
  return list;
}

function clipBox(item: ArchiveItem) {
  return {
    l: (item.x / 100) * ARCHIVE.clipLayoutW,
    t: (item.y / 100) * ARCHIVE.clipLayoutH,
    r: (item.x / 100) * ARCHIVE.clipLayoutW + item.w,
    b: (item.y / 100) * ARCHIVE.clipLayoutH + item.h,
  };
}

function clipsNear(a: ArchiveItem, b: ArchiveItem) {
  const pad = ARCHIVE.clipNearPadPx;
  const A = clipBox(a);
  const B = clipBox(b);
  return !(
    A.r + pad < B.l ||
    B.r + pad < A.l ||
    A.b + pad < B.t ||
    B.b + pad < A.t
  );
}

function collectClips(projects: Project[]): ArchiveClip[] {
  return projects.flatMap((project) => {
    const slug = project.slug ?? project._id;
    const imgs = urls(project.previewImage);
    const files = project.previewVideo ?? [];
    const videos = urls(files);
    if (!slug) {
      return [];
    }
    return files.flatMap((file, index) => {
      const url = file?.asset?.url;
      if (!url) {
        return [];
      }
      return [{
        id: `${project._id}-v-${index}`,
        url,
        slug,
        title: project.title,
        year: project.year,
        category: project.category,
        shortDescription: project.shortDescription,
        description: project.description ?? null,
        filename: file.asset?.originalFilename ?? null,
        role: project.role ?? null,
        tools: project.tools ?? null,
        client: project.client ?? null,
        order: project.order ?? null,
        image: imgs[0] ?? null,
        images: imgs,
        videos,
        clipIndex: index + 1,
      }];
    });
  });
}

function applyClip(item: ArchiveItem, clip: ArchiveClip) {
  const others = clip.videos.filter((url) => url !== clip.url);
  item.slug = clip.slug;
  item.projectTitle = clip.title;
  item.year = clip.year;
  item.category = clip.category;
  item.shortDescription = clip.shortDescription;
  item.description = clip.description;
  item.filename = clip.filename;
  item.role = clip.role;
  item.tools = clip.tools;
  item.client = clip.client;
  item.order = clip.order;
  item.image = item.image ?? clip.image;
  item.video = clip.url;
  item.images = item.images.length ? item.images : clip.images;
  item.videos = [clip.url, ...others];
  item.clickable = true;
  item.residual = 0;
}

function makePool(clips: ArchiveClip[], count: number, rng: () => number) {
  if (!clips.length || count <= 0) {
    return [];
  }
  if (clips.length >= count) {
    return shuffle([...clips], rng).slice(0, count);
  }
  const pool: ArchiveClip[] = [];
  while (pool.length < count) {
    const wave = shuffle([...clips], rng);
    const last = pool[pool.length - 1];
    if (last && wave.length > 1 && wave[0]?.url === last.url) {
      const swap = wave.findIndex((clip, index) => index > 0 && clip.url !== last.url);
      if (swap > 0) {
        const first = wave[0];
        const next = wave[swap];
        if (first && next) {
          wave[0] = next;
          wave[swap] = first;
        }
      }
    }
    pool.push(...wave);
  }
  return pool.slice(0, count);
}

function swapClipData(a: ArchiveItem, b: ArchiveItem) {
  const hold = {
    slug: a.slug,
    projectTitle: a.projectTitle,
    year: a.year,
    category: a.category,
    shortDescription: a.shortDescription,
    description: a.description,
    filename: a.filename,
    role: a.role,
    tools: a.tools,
    client: a.client,
    order: a.order,
    video: a.video,
    videos: a.videos,
    cueAt: a.cueAt,
  };
  a.slug = b.slug;
  a.projectTitle = b.projectTitle;
  a.year = b.year;
  a.category = b.category;
  a.shortDescription = b.shortDescription;
  a.description = b.description;
  a.filename = b.filename;
  a.role = b.role;
  a.tools = b.tools;
  a.client = b.client;
  a.order = b.order;
  a.video = b.video;
  a.videos = b.videos;
  a.cueAt = b.cueAt;
  b.slug = hold.slug;
  b.projectTitle = hold.projectTitle;
  b.year = hold.year;
  b.category = hold.category;
  b.shortDescription = hold.shortDescription;
  b.description = hold.description;
  b.filename = hold.filename;
  b.role = hold.role;
  b.tools = hold.tools;
  b.client = hold.client;
  b.order = hold.order;
  b.video = hold.video;
  b.videos = hold.videos;
  b.cueAt = hold.cueAt;
}

function neighborClashCount(items: ArchiveItem[]) {
  let count = 0;
  for (let i = 0; i < items.length; i += 1) {
    const a = items[i];
    if (!a?.video) {
      continue;
    }
    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j];
      if (b?.video && a.video === b.video && clipsNear(a, b)) {
        count += 1;
      }
    }
  }
  return count;
}

function reduceNeighborClashes(items: ArchiveItem[], rng: () => number) {
  const movable = items.filter((item) => item.video && item.clipIndex == null);
  let best = neighborClashCount(items);
  for (let pass = 0; pass < 120 && best > 0; pass += 1) {
    const i = Math.floor(rng() * movable.length);
    const j = Math.floor(rng() * movable.length);
    const a = movable[i];
    const b = movable[j];
    if (!a || !b || a.id === b.id || a.video === b.video) {
      continue;
    }
    swapClipData(a, b);
    const next = neighborClashCount(items);
    if (next <= best) {
      best = next;
    } else {
      swapClipData(a, b);
    }
  }
}

function fillEmptyWindows(items: ArchiveItem[], clips: ArchiveClip[], rng: () => number) {
  const slots = items.filter((item) => !item.video);
  const pool = makePool(clips, slots.length, rng);
  shuffle(slots, rng);
  for (const slot of slots) {
    const used = new Set(
      items
        .filter((item) => item.id !== slot.id && item.video && clipsNear(slot, item))
        .map((item) => item.video),
    );
    let index = pool.findIndex((clip) => !used.has(clip.url));
    if (index < 0) {
      index = 0;
    }
    const clip = pool.splice(index, 1)[0];
    if (clip) {
      applyClip(slot, clip);
    }
  }
}

function spreadCues(items: ArchiveItem[], rng: () => number) {
  const groups = new Map<string, ArchiveItem[]>();
  for (const item of items) {
    if (!item.video) {
      continue;
    }
    const group = groups.get(item.video) ?? [];
    group.push(item);
    groups.set(item.video, group);
  }
  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0];
      if (only) {
        only.cueAt = ARCHIVE.videoCueAt;
      }
      continue;
    }
    const span = ARCHIVE.clipCueMax - ARCHIVE.clipCueMin;
    const cues = group.map((_, index) => {
      const base = ARCHIVE.clipCueMin + (span * index) / group.length;
      return Math.min(
        ARCHIVE.clipCueMax,
        Math.max(ARCHIVE.clipCueMin, base + (rng() - 0.5) * ARCHIVE.clipCueJitter),
      );
    });
    shuffle(cues, rng);
    group.forEach((item, index) => {
      item.cueAt = cues[index] ?? ARCHIVE.videoCueAt;
    });
  }
}

const FRAG_TITLES = [
  "REC_???.MOV",
  "FILE_0A.MOV",
  "----.MOV",
  "LOG/ERR.MOV",
  "TAPE_04.MOV",
  "NULL.MOV",
];

export function buildArchiveItems(projects: Project[]): ArchiveItem[] {
  const ordered = [...projects].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const rng = mulberry32(sessionSeed());
  const clips = collectClips(ordered);
  const images = ordered.flatMap((project) => urls(project.previewImage));
  const real: ArchiveItem[] = clips.map((clip) => ({
    id: clip.id,
    slug: clip.slug,
    title: clip.title,
    projectTitle: clip.title,
    year: clip.year,
    category: clip.category,
    shortDescription: clip.shortDescription,
    description: clip.description,
    filename: clip.filename,
    role: clip.role,
    tools: clip.tools,
    client: clip.client,
    order: clip.order,
    image: clip.image,
    video: clip.url,
    images: clip.images,
    videos: [clip.url, ...clip.videos.filter((url) => url !== clip.url)],
    kind: "project",
    clipIndex: clip.clipIndex,
    cueAt: ARCHIVE.videoCueAt,
    clickable: true,
    crop: "50% 50%",
    residual: 0,
    ...scatter(rng),
    ...tiltOf(rng),
  }));

  const total = randInt(rng, ARCHIVE.winCountMin, ARCHIVE.winCountMax);
  const kinds: ArchiveKind[] = ["noise", "crop", "bar"];
  let n = 0;
  while (real.length < total) {
    const kind = kinds[n % kinds.length] ?? "noise";
    n += 1;
    const src = images.length ? images[Math.floor(rng() * images.length)] ?? null : null;
    real.push({
      id: `frag-${n}`,
      slug: `frag-${n}`,
      title: FRAG_TITLES[Math.floor(rng() * FRAG_TITLES.length)] ?? "----.MOV",
      projectTitle: null,
      year: null,
      category: null,
      shortDescription: null,
      description: null,
      filename: null,
      role: null,
      tools: null,
      client: null,
      order: null,
      image: kind === "crop" ? src : null,
      video: null,
      images: src && kind === "crop" ? [src] : [],
      videos: [],
      kind,
      clipIndex: null,
      cueAt: ARCHIVE.videoCueAt,
      clickable: false,
      crop: `${Math.round(rng() * 100)}% ${Math.round(rng() * 100)}%`,
      residual: randRange(rng, 0.3, 0.5),
      ...scatter(rng),
      ...tiltOf(rng),
    });
  }

  fillEmptyWindows(real, clips, rng);
  reduceNeighborClashes(real, rng);
  spreadCues(real, rng);
  return shuffle(real, rng);
}
