import {ARCHIVE} from "@/components/archive/archiveConfig";
import type {ArchiveItem} from "@/components/archive/archiveItems";

export type TuneLook = {
  blur: number;
  opacity: number;
  contrast: number;
  sat: number;
  rgb: number;
  noise: number;
  scale: number;
  z: number;
  zIndex: number;
};

export type TuneBand = 0 | 1 | 2;

export type TuneRank = {
  id: string;
  band: TuneBand;
};

export function tuneIdleLook(): TuneLook {
  return {
    blur: ARCHIVE.tuneIdleBlur,
    opacity: ARCHIVE.tuneIdleOpacity,
    contrast: ARCHIVE.tuneIdleContrast,
    sat: ARCHIVE.tuneIdleSat,
    rgb: ARCHIVE.tuneIdleRgb,
    noise: ARCHIVE.tuneIdleNoise,
    scale: 1,
    z: 0,
    zIndex: 1,
  };
}

export function tuneActiveLook(): TuneLook {
  return {
    blur: 0,
    opacity: 1,
    contrast: ARCHIVE.tuneActiveContrast,
    sat: 1,
    rgb: 0,
    noise: 0,
    scale: 1,
    z: 0,
    zIndex: 8,
  };
}

export function tuneBgLook(band: TuneBand): TuneLook {
  if (band === 0) {
    return {
      blur: ARCHIVE.tuneBgNearBlur,
      opacity: ARCHIVE.tuneBgNearOpacity,
      contrast: 0.96,
      sat: 0.78,
      rgb: 0.8,
      noise: 0.12,
      scale: 1,
      z: 0,
      zIndex: 1,
    };
  }
  if (band === 1) {
    return {
      blur: ARCHIVE.tuneBgMidBlur,
      opacity: ARCHIVE.tuneBgMidOpacity,
      contrast: 0.92,
      sat: 0.62,
      rgb: 1.2,
      noise: 0.18,
      scale: 1,
      z: 0,
      zIndex: 1,
    };
  }
  return {
    blur: ARCHIVE.tuneBgFarBlur,
    opacity: ARCHIVE.tuneBgFarOpacity,
    contrast: 0.88,
    sat: 0.48,
    rgb: 1.6,
    noise: 0.22,
    scale: 1,
    z: 0,
    zIndex: 1,
  };
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function idleLook(item: ArchiveItem): TuneLook {
  if (item.clickable) {
    return tuneIdleLook();
  }
  return {
    blur: 0.4,
    opacity: 1,
    contrast: 1,
    sat: 0.8,
    rgb: 0,
    noise: item.residual,
    scale: 1,
    z: 0,
    zIndex: 1,
  };
}

export function mixLooks(a: TuneLook, b: TuneLook, t: number): TuneLook {
  const u = Math.min(1, Math.max(0, t));
  return {
    blur: mix(a.blur, b.blur, u),
    opacity: mix(a.opacity, b.opacity, u),
    contrast: mix(a.contrast, b.contrast, u),
    sat: mix(a.sat, b.sat, u),
    rgb: mix(a.rgb, b.rgb, u),
    noise: mix(a.noise, b.noise, u),
    scale: mix(a.scale, b.scale, u),
    z: mix(a.z, b.z, u),
    zIndex: Math.round(mix(a.zIndex, b.zIndex, u)),
  };
}

export function autoLayEaseT(t: number) {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3.2;
}

export function approachLook(t: number): TuneLook {
  const u = Math.min(1, Math.max(0, t));
  const idle = tuneIdleLook();
  return {
    blur: mix(idle.blur, 0.05, u),
    opacity: mix(idle.opacity, 0.97, u),
    contrast: mix(idle.contrast, ARCHIVE.tuneActiveContrast, u),
    sat: mix(idle.sat, 1, u),
    rgb: mix(idle.rgb, 0.25, u),
    noise: mix(idle.noise, 0.03, u),
    scale: 1,
    z: 0,
    zIndex: 3,
  };
}

export function nodeCenter(
  id: string,
  nodes: Map<string, HTMLElement>,
  fallback?: {x: number; y: number; w: number; h: number},
) {
  const node = nodes.get(id);
  if (node) {
    const box = node.getBoundingClientRect();
    return {x: box.x + box.width * 0.5, y: box.y + box.height * 0.5};
  }
  if (fallback) {
    return {x: fallback.x + fallback.w * 0.5, y: fallback.y + fallback.h * 0.5};
  }
  return {x: 0, y: 0};
}

export function rankFromOrigin(
  originId: string,
  items: ArchiveItem[],
  origin: {x: number; y: number},
  nodes: Map<string, HTMLElement>,
): TuneRank[] {
  const vw = window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const ranked = items
    .filter((item) => item.id !== originId)
    .map((item) => {
      const center = nodeCenter(item.id, nodes, {
        x: (item.x / 100) * vw,
        y: (item.y / 100) * vh,
        w: item.w,
        h: item.h,
      });
      return {id: item.id, dist: Math.hypot(origin.x - center.x, origin.y - center.y)};
    })
    .sort((a, b) => a.dist - b.dist);
  const n = ranked.length;
  return ranked.map((row, index) => {
    const band: TuneBand = index < n / 3 ? 0 : index < (n * 2) / 3 ? 1 : 2;
    return {id: row.id, band};
  });
}

export function paintTune(root: HTMLElement | undefined, look: TuneLook) {
  if (!root) {
    return;
  }
  root.style.opacity = String(look.opacity);
  root.style.filter = `blur(${look.blur.toFixed(2)}px) contrast(${look.contrast.toFixed(2)}) saturate(${look.sat.toFixed(2)})`;
  root.style.setProperty("--arc-tune-zi", String(look.zIndex));
  root.style.setProperty("--arc-tune-scale", look.scale.toFixed(3));
  root.style.setProperty("--arc-tune-z", `${look.z.toFixed(1)}px`);
  const rgb = root.querySelector<HTMLElement>(".arc-win__rgb");
  const sig = root.querySelector<HTMLElement>(".arc-win__sig");
  if (rgb) {
    rgb.style.opacity = look.rgb > 0.2 ? "1" : "0";
    rgb.style.boxShadow =
      look.rgb > 0.2
        ? `${look.rgb.toFixed(1)}px 0 0 rgba(255, 36, 78, 0.7), ${(-look.rgb).toFixed(1)}px 0 0 rgba(28, 220, 255, 0.7)`
        : "none";
  }
  if (sig) {
    sig.style.opacity = look.noise.toFixed(3);
  }
}

export function clearTune(root: HTMLElement | undefined) {
  if (!root) {
    return;
  }
  root.style.opacity = "";
  root.style.filter = "";
  root.style.removeProperty("--arc-tune-zi");
  root.style.removeProperty("--arc-tune-scale");
  root.style.removeProperty("--arc-tune-z");
  root.classList.remove("arc-win--tune-lock");
  root.style.translate = "";
  const rgb = root.querySelector<HTMLElement>(".arc-win__rgb");
  const sig = root.querySelector<HTMLElement>(".arc-win__sig");
  if (rgb) {
    rgb.style.opacity = "0";
    rgb.style.boxShadow = "none";
  }
  if (sig) {
    sig.style.opacity = "0";
  }
}

export function playTuneLock(root: HTMLElement | undefined) {
  if (!root) {
    return;
  }
  root.classList.add("arc-win--tune-lock");
  window.setTimeout(() => {
    root.classList.remove("arc-win--tune-lock");
  }, ARCHIVE.tuneLockMs);
}
