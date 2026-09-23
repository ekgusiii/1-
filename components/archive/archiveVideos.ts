import {ARCHIVE} from "@/components/archive/archiveConfig";

export type VideoBind = {
  el: HTMLVideoElement;
  x: number;
  y: number;
};

export type VideoDrive = {
  enabled: boolean;
  stoodId: string | null;
  focusId: string | null;
  lossOf: (id: string) => number;
  dead: (id: string) => boolean;
};

const lastTime = new Map<string, number>();

export function cueArchiveVideo(id: string, el: HTMLVideoElement) {
  if (el.dataset.cueBound === "1") {
    return;
  }
  el.dataset.cueBound = "1";
  const paint = () => {
    const play = el.play();
    if (play) {
      play
        .then(() => {
          el.pause();
        })
        .catch(() => {});
    }
  };
  const cue = () => {
    const duration = el.duration;
    if (!duration || !Number.isFinite(duration) || duration <= 0) {
      return;
    }
    const saved = lastTime.get(id);
    const at =
      saved && saved > 0.05 ? saved : duration * ARCHIVE.videoCueAt;
    const apply = () => {
      el.removeEventListener("seeked", apply);
      lastTime.set(id, el.currentTime);
      paint();
    };
    if (el.dataset.cued === "1" && Math.abs(el.currentTime - at) < 0.08) {
      paint();
      return;
    }
    el.dataset.cued = "1";
    el.addEventListener("seeked", apply);
    el.currentTime = at;
  };
  el.addEventListener("timeupdate", () => {
    lastTime.set(id, el.currentTime);
  });
  if (el.readyState >= 1) {
    cue();
  }
  el.addEventListener("loadedmetadata", cue, {once: true});
  el.addEventListener("loadeddata", cue, {once: true});
}

function rootId(id: string) {
  return id.replace(/-d-\d+$/, "");
}

export function driveVideos(
  registry: Map<string, VideoBind>,
  cursor: {x: number; y: number; speed: number},
  dt: number,
  drive?: VideoDrive,
) {
  const near = (window.visualViewport?.height ?? window.innerHeight) * ARCHIVE.videoNear;
  const ranked = [...registry.entries()]
    .map(([id, bind]) => ({
      id,
      bind,
      dist: Math.hypot(cursor.x - bind.x, cursor.y - bind.y),
    }))
    .sort((a, b) => a.dist - b.dist);

  ranked.forEach((entry, index) => {
    const video = entry.bind.el;
    const id = rootId(entry.id);
    if (drive?.dead(id) || drive?.dead(entry.id)) {
      video.dataset.shake = "0";
      return;
    }
    const stood = Boolean(
      drive?.stoodId && (id === drive.stoodId || entry.id.startsWith(drive.stoodId)),
    );
    if (drive?.enabled && !stood) {
      video.dataset.shake = "0";
      return;
    }
    let weight = Math.max(0, 1 - entry.dist / Math.max(near, 1));
    if (drive?.enabled) {
      weight = stood ? 1 : 0;
    }
    const active = index < ARCHIVE.videoMaxActive && weight > 0.03;
    if (active && cursor.speed > 0.015) {
      const duration = video.duration;
      if (duration && Number.isFinite(duration) && duration > 0) {
        const boost = drive?.enabled && drive.focusId === id ? 1 : weight;
        let next = video.currentTime + cursor.speed * dt * ARCHIVE.videoK * boost;
        next %= duration;
        if (next < 0) {
          next += duration;
        }
        if (Math.abs(next - video.currentTime) > 0.001) {
          video.currentTime = next;
        }
      }
      video.dataset.shake = cursor.speed > 0.35 ? "1" : "0";
    } else {
      video.dataset.shake = "0";
    }
    video.dataset.still = cursor.speed < 0.02 ? "1" : "0";
  });
}
