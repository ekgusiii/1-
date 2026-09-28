import {ARCHIVE} from "@/components/archive/archiveConfig";
import {SoundEngine} from "@/lib/sound/SoundEngine";

export type VideoBind = {
  el: HTMLVideoElement;
  x: number;
  y: number;
};

export type VideoDrive = {
  previewId: string | null;
};

type Trailer = {
  el: HTMLVideoElement;
  story: number;
  until: number;
  busy: boolean;
};

const trailers = new Map<string, Trailer>();

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function flashCut(el: HTMLVideoElement) {
  el.dataset.cut = "1";
  window.setTimeout(() => {
    el.dataset.cut = "0";
  }, ARCHIVE.trailerCutMs);
}

function paintFrame(el: HTMLVideoElement) {
  const play = el.play();
  if (play) {
    play
      .then(() => {
        el.pause();
      })
      .catch(() => {});
  } else {
    el.pause();
  }
}

function cutTrailer(state: Trailer, now: number) {
  if (state.busy || state.el.dataset.hear === "1") {
    return;
  }
  const el = state.el;
  const duration = el.duration;
  if (!duration || !Number.isFinite(duration) || duration <= 0) {
    state.until = now + 200;
    return;
  }
  state.busy = true;
  const jitter = (Math.random() - 0.5) * 2 * ARCHIVE.trailerStoryJitter;
  const at = Math.min(
    duration * 0.96,
    Math.max(0.04, (state.story + jitter) * duration),
  );
  const moving = Math.random() < ARCHIVE.trailerMoveChance;
  state.until =
    now +
    (moving
      ? rand(ARCHIVE.trailerMoveMsMin, ARCHIVE.trailerMoveMsMax)
      : rand(ARCHIVE.trailerStillMsMin, ARCHIVE.trailerStillMsMax));
  state.story += rand(ARCHIVE.trailerStoryStepMin, ARCHIVE.trailerStoryStepMax);
  if (state.story > 0.92) {
    state.story = ARCHIVE.trailerStoryStart + Math.random() * 0.05;
  }
  el.muted = true;
  const apply = () => {
    el.removeEventListener("seeked", apply);
    state.busy = false;
    flashCut(el);
    if (moving) {
      el.play().catch(() => {});
    } else {
      paintFrame(el);
    }
  };
  if (Math.abs(el.currentTime - at) < 0.02) {
    apply();
    return;
  }
  el.addEventListener("seeked", apply);
  el.currentTime = at;
}

function startTrailer(id: string, el: HTMLVideoElement, now: number) {
  if (el.dataset.hear === "1") {
    el.muted = SoundEngine.get().isMuted;
    if (!el.muted && el.paused) {
      el.play().catch(() => {});
    }
    return;
  }
  const prev = trailers.get(id);
  if (prev?.el === el) {
    return;
  }
  stopTrailer(id, prev?.el);
  const state: Trailer = {
    el,
    story: ARCHIVE.trailerStoryStart + Math.random() * 0.04,
    until: 0,
    busy: false,
  };
  trailers.set(id, state);
  el.muted = true;
  cutTrailer(state, now);
}

function stopTrailer(id: string, el?: HTMLVideoElement) {
  if (el?.dataset.hear === "1") {
    return;
  }
  trailers.delete(id);
  if (!el) {
    return;
  }
  el.pause();
  el.dataset.cut = "0";
  el.dataset.shake = "0";
  const duration = el.duration;
  if (duration && Number.isFinite(duration) && duration > 0) {
    el.currentTime = duration * ARCHIVE.videoCueAt;
  }
}

export function cueArchiveVideo(
  id: string,
  el: HTMLVideoElement,
  cueAt: number = ARCHIVE.videoCueAt,
) {
  if (!el.src) {
    return;
  }
  const token = `${el.currentSrc || el.src}|${cueAt.toFixed(3)}`;
  if (el.dataset.cueBound === token) {
    return;
  }
  el.dataset.cueBound = token;
  el.dataset.cued = "0";
  const cue = () => {
    const duration = el.duration;
    if (!duration || !Number.isFinite(duration) || duration <= 0) {
      return;
    }
    const at = duration * cueAt;
    const apply = () => {
      el.removeEventListener("seeked", apply);
      paintFrame(el);
    };
    if (el.dataset.cued === "1" && Math.abs(el.currentTime - at) < 0.08) {
      paintFrame(el);
      return;
    }
    el.dataset.cued = "1";
    el.addEventListener("seeked", apply);
    el.currentTime = at;
  };
  if (el.readyState >= 1) {
    cue();
  }
  el.addEventListener("loadedmetadata", cue, {once: true});
  el.addEventListener("loadeddata", cue, {once: true});
}

function rootId(id: string) {
  return id.replace(/-d-\d+$/, "");
}

const volumeFade = new WeakMap<HTMLVideoElement, number>();
const heard = new Set<HTMLVideoElement>();

export function setArchiveHearMuted(muted: boolean) {
  for (const el of heard) {
    el.muted = muted;
    el.volume = muted ? 0 : 1;
  }
}

function fadeVideoVolume(el: HTMLVideoElement, to: number, ms: number, done?: () => void) {
  const token = (volumeFade.get(el) ?? 0) + 1;
  volumeFade.set(el, token);
  const from = el.volume;
  const start = performance.now();
  const step = (now: number) => {
    if (volumeFade.get(el) !== token) {
      return;
    }
    const t = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
    const level = from + (to - from) * t;
    el.volume = SoundEngine.get().isMuted ? 0 : level;
    if (t < 1) {
      window.requestAnimationFrame(step);
      return;
    }
    done?.();
  };
  window.requestAnimationFrame(step);
}

export function claimArchiveVideo(el: HTMLVideoElement) {
  el.dataset.hear = "1";
  heard.add(el);
  el.muted = SoundEngine.get().isMuted;
  el.volume = 0;
  el.play().catch(() => {});
  fadeVideoVolume(el, 1, 150);
}

export function releaseArchiveAudio(el: HTMLVideoElement) {
  if (el.dataset.hear !== "1") {
    return;
  }
  fadeVideoVolume(el, 0, 150, () => {
    el.pause();
    el.muted = true;
    el.volume = 0;
    delete el.dataset.hear;
    heard.delete(el);
  });
}

export function holdArchiveVideo(el: HTMLVideoElement) {
  el.dataset.hold = "1";
  if (el.dataset.hear === "1") {
    return;
  }
  el.pause();
}

export function releaseArchiveVideo(el: HTMLVideoElement) {
  delete el.dataset.hold;
}

export function driveVideos(
  registry: Map<string, VideoBind>,
  now: number,
  drive?: VideoDrive,
) {
  const previewId = drive?.previewId ?? null;
  for (const [id, bind] of registry) {
    if (id.includes("-d-")) {
      continue;
    }
    const key = rootId(id);
    const el = bind.el;
    if (el.dataset.hold === "1" && el.dataset.hear !== "1") {
      el.pause();
      continue;
    }
    const preview = Boolean(previewId && key === previewId);
    if (preview) {
      if (el.dataset.hear === "1") {
        el.muted = SoundEngine.get().isMuted;
        if (!el.muted && el.paused) {
          el.play().catch(() => {});
        }
        continue;
      }
      startTrailer(key, el, now);
      const state = trailers.get(key);
      if (state && now >= state.until) {
        cutTrailer(state, now);
      }
      continue;
    }
    if (trailers.has(key)) {
      stopTrailer(key, el);
    }
    el.dataset.shake = "0";
    el.dataset.cut = "0";
  }
  for (const id of [...trailers.keys()]) {
    if (id !== previewId) {
      stopTrailer(id, trailers.get(id)?.el);
    }
  }
}
