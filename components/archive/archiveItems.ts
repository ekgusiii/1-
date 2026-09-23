import {ARCHIVE, mulberry32, randInt, randRange} from "@/components/archive/archiveConfig";
import type {Project} from "@/sanity/lib/queries";

export type ArchiveKind = "project" | "noise" | "crop" | "bar";

export type ArchiveItem = {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  category: string | null;
  shortDescription: string | null;
  image: string | null;
  video: string | null;
  images: string[];
  videos: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ArchiveKind;
  clickable: boolean;
  crop: string;
  residual: number;
  tiltX: number;
  tiltZ: number;
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
  const images = ordered.flatMap((project) => urls(project.previewImage));
  const real: ArchiveItem[] = [];

  for (const project of ordered) {
    const slug = project.slug ?? project._id;
    const imgs = urls(project.previewImage);
    const videos = urls(project.previewVideo);
    if (!slug) {
      continue;
    }
    real.push({
      id: project._id,
      slug,
      title: project.title,
      year: project.year,
      category: project.category,
      shortDescription: project.shortDescription,
      image: imgs[0] ?? null,
      video: videos[0] ?? null,
      images: imgs,
      videos,
      kind: "project",
      clickable: true,
      crop: "50% 50%",
      residual: 0,
      ...scatter(rng),
      ...tiltOf(rng),
    });
  }

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
      year: null,
      category: null,
      shortDescription: null,
      image: kind === "crop" ? src : null,
      video: null,
      images: src && kind === "crop" ? [src] : [],
      videos: [],
      kind,
      clickable: false,
      crop: `${Math.round(rng() * 100)}% ${Math.round(rng() * 100)}%`,
      residual: randRange(rng, 0.3, 0.5),
      ...scatter(rng),
      ...tiltOf(rng),
    });
  }

  for (let i = real.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = real[i];
    const b = real[j];
    if (a && b) {
      real[i] = b;
      real[j] = a;
    }
  }

  return real;
}
