"use client";

import {IBM_Plex_Mono, VT323} from "next/font/google";
import {useEffect, useRef} from "react";

import {readMoireShare} from "@/lib/moireShare";
import {publishGhostTick} from "@/lib/sound/soundBus";

const POOL = 8;
const MAX_VISIBLE = 5;
const EDGE = 24;
const NEAR = 140;
const PLACE_TRIES = 5;
const MAX_FONT = 18;
const MAX_LINE = 52;
const MAX_ROTATE = 8;
const MAX_SKEW = 12;
const GHOST_BLUR_MIN = 1.5;
const GHOST_BLUR_MAX = 2.5;
const GHOST_OPACITY_MIN = 0.3;
const GHOST_OPACITY_MAX = 0.5;
const GHOST_TRACKING_MIN = 0.06;
const GHOST_TRACKING_MAX = 0.12;
const GHOST_SIZE_STREAK_MIN = 9;
const GHOST_SIZE_STREAK_MAX = 13;
const GHOST_SIZE_LEAK_MIN = 11;
const GHOST_SIZE_LEAK_MAX = 17;
const GHOST_RGB = "220, 240, 255";
const GHOST_FILL_A = 0.35;
const GHOST_COLOR = `rgba(${GHOST_RGB}, ${GHOST_FILL_A})`;
const GHOST_BLEND = "screen";

const WORDS = [
  "PLAY ▸",
  "REC ●",
  "CH 03",
  "TRACKING",
  "SP",
  "AUTO",
  "INPUT 1",
  "SYNC",
  "HOLD",
  "TUNE",
  "ALIGN",
  "BEAT",
] as const;

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ghost-vt",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ghost-ibm",
  display: "swap",
});

type GhostKind = "streak" | "leak";

type Ghost = {
  active: boolean;
  kind: GhostKind;
  text: string;
  double: boolean;
  doubleX: number;
  doubleY: number;
  x: number;
  y: number;
  born: number;
  appearMs: number;
  holdMs: number;
  exitMs: number;
  maxOpacity: number;
  fontSize: number;
  scaleX: number;
  rotate: number;
  skewX: number;
  blur: number;
  letterSpacing: number;
  slideIn: number;
  driftX: number;
  driftY: number;
  glitch: boolean;
  glitchAt: number;
  glitchAmp: number;
};

type Point = {x: number; y: number};

function rand() {
  return Math.random();
}

function range(min: number, max: number) {
  return min + rand() * (max - min);
}

function pad(value: number, width: number) {
  return String(Math.max(0, Math.floor(value))).padStart(width, "0");
}

function hexN(len: number) {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += "0123456789abcdef"[Math.floor(rand() * 16)];
  }
  return out;
}

function hex4() {
  return hexN(4).toUpperCase();
}

function octet(min: number, max: number) {
  return Math.floor(range(min, max + 1));
}

function clampFont(size: number) {
  return Math.min(MAX_FONT, Math.max(GHOST_SIZE_STREAK_MIN, size));
}

function pickFontSize(kind: GhostKind) {
  if (kind === "streak") {
    return clampFont(
      range(GHOST_SIZE_STREAK_MIN, GHOST_SIZE_STREAK_MAX),
    );
  }
  return clampFont(
    GHOST_SIZE_LEAK_MIN +
      Math.pow(rand(), 1.6) * (GHOST_SIZE_LEAK_MAX - GHOST_SIZE_LEAK_MIN),
  );
}

function tiltFromPosition(x: number, y: number, width: number, height: number) {
  const nx = Math.max(-1, Math.min(1, (x - width * 0.5) / Math.max(width * 0.5, 1)));
  const ny = Math.max(-1, Math.min(1, (y - height * 0.5) / Math.max(height * 0.5, 1)));
  return {
    rotate: -nx * ny * MAX_ROTATE,
    skewX: -nx * MAX_SKEW,
  };
}

function ghostStreakShadow() {
  return [
    `-10px 0 2px rgba(${GHOST_RGB}, 0.08)`,
    `-6px 0 1.2px rgba(${GHOST_RGB}, 0.16)`,
    `-3px 0 0.8px rgba(${GHOST_RGB}, 0.22)`,
    `3px 0 0.8px rgba(${GHOST_RGB}, 0.22)`,
    `6px 0 1.2px rgba(${GHOST_RGB}, 0.16)`,
    `10px 0 2px rgba(${GHOST_RGB}, 0.08)`,
  ].join(", ");
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function pickAtom(mouseX: number, mouseY: number) {
  const roll = rand();
  if (roll < 0.2) {
    return `${pad(range(0, 24), 2)}:${pad(range(0, 60), 2)}:${pad(range(0, 60), 2)}:${pad(range(0, 30), 2)}`;
  }
  if (roll < 0.4) {
    return rand() < 0.5
      ? `${range(8, 96).toFixed(2)}Hz`
      : `${range(12, 21).toFixed(3)}kHz`;
  }
  if (roll < 0.6) {
    return `X ${pad(mouseX, 4)} Y ${pad(mouseY, 4)}`;
  }
  if (roll < 0.8) {
    return WORDS[Math.floor(rand() * WORDS.length)] ?? "SYNC";
  }
  return `0x${hex4()} 0x${hex4()}`;
}

function composeStreak(mouseX: number, mouseY: number) {
  const count = 1 + Math.floor(rand() * 3);
  return Array.from({length: count}, () => pickAtom(mouseX, mouseY)).join(" ");
}

function pickUrl() {
  const roll = rand();
  if (roll < 0.25) {
    return `http://thenow.tv/ch${pad(range(1, 13), 2)}/archive?id=${hexN(4)}`;
  }
  if (roll < 0.5) {
    return `rtsp://10.${octet(1, 12)}.${octet(0, 8)}.${octet(1, 80)}:554/live/cam_${pad(range(1, 17), 2)}`;
  }
  if (roll < 0.75) {
    return `ftp://192.168.${octet(0, 4)}.${octet(1, 90)}/restricted/tape_${pad(range(1, 25), 2)}/`;
  }
  return `file:///VAULT/SIGNAL_0x${hex4()}.dat`;
}

function pickAccess() {
  const roll = rand();
  if (roll < 0.34) {
    return `login: admin_${pad(range(1, 32), 2)}  pass: ••••••••`;
  }
  if (roll < 0.67) {
    return `session=${hexN(10)}..`;
  }
  return `token: eyJhbGci${hexN(6)}...`;
}

function pickClassified() {
  const roll = rand();
  if (roll < 0.25) {
    return `CLASSIFIED // LEVEL ${1 + octet(0, 4)}`;
  }
  if (roll < 0.5) {
    return "[REDACTED]";
  }
  if (roll < 0.75) {
    return "ACCESS DENIED";
  }
  return "DO NOT DISTRIBUTE";
}

function pickSignal() {
  const roll = rand();
  if (roll < 0.34) {
    return `LAT ${(36.8 + rand() * 1.4).toFixed(4)} N  LON ${(126.4 + rand() * 1.6).toFixed(4)} E`;
  }
  if (roll < 0.67) {
    return `FREQ ${(12 + rand() * 9).toFixed(3)}kHz  SYNC LOCK`;
  }
  return `SRC 0x${hex4()}-${hexN(2).toUpperCase()} → 0x${hex4()}`;
}

function pickPath() {
  const roll = rand();
  if (roll < 0.5) {
    return `/usr/local/thenow/.hidden/frame_${pad(range(0, 10000), 4)}.raw`;
  }
  return `/var/spool/thenow/ch${pad(range(1, 13), 2)}/tape_${pad(range(1, 25), 2)}.dat`;
}

function pickFragment() {
  const roll = rand();
  if (roll < 0.22) {
    return pickUrl();
  }
  if (roll < 0.42) {
    return pickAccess();
  }
  if (roll < 0.62) {
    return pickClassified();
  }
  if (roll < 0.82) {
    return pickSignal();
  }
  return pickPath();
}

function redactMiddle(text: string) {
  if (text.length < 10) {
    return text;
  }
  const mark = rand() < 0.5 ? "▮" : "•";
  const start = Math.floor(range(2, Math.max(3, text.length * 0.45)));
  const span = Math.floor(range(3, Math.min(8, text.length - start - 2)));
  if (span < 2) {
    return text;
  }
  return `${text.slice(0, start)}${mark.repeat(span)}${text.slice(start + span)}`;
}

function clipEnds(text: string) {
  if (text.length < 8) {
    return text;
  }
  const cut = 3 + Math.floor(rand() * Math.min(10, text.length - 6));
  if (rand() < 0.5) {
    return `...${text.slice(cut)}`;
  }
  return `${text.slice(0, text.length - cut)}...`;
}

function composeLeak() {
  const a = pickFragment();
  let b = pickFragment();
  for (let i = 0; i < 4 && b === a; i += 1) {
    b = pickFragment();
  }
  const sep = rand() < 0.5 ? " // " : "  ";
  let text = `${a}${sep}${b}`;
  if (text.length > MAX_LINE) {
    text = text.slice(0, MAX_LINE).trim();
  }
  if (rand() < 0.3) {
    text = redactMiddle(text);
  }
  if (rand() < 0.2) {
    text = clipEnds(text);
  }
  if (text.length > MAX_LINE) {
    text = text.slice(0, MAX_LINE).trim();
  }
  return text;
}

function welcomeBox() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const size = height * 0.123;
  const tracking = size * 0.22;
  const total = size * 0.62 * 7 + tracking * 6;
  const padX = size * 0.9;
  const padY = size * 1.05;
  return {
    left: width * 0.5 - total * 0.5 - padX,
    right: width * 0.5 + total * 0.5 + padX,
    top: height * 0.5 - padY,
    bottom: height * 0.5 + padY,
  };
}

function ghostCorners(
  x: number,
  y: number,
  fontSize: number,
  textLen: number,
  scaleX: number,
  rotate: number,
  skewX: number,
) {
  const w = fontSize * 0.62 * Math.max(1, textLen);
  const h = fontSize * 1.2;
  const tan = Math.tan((skewX * Math.PI) / 180);
  const rot = (rotate * Math.PI) / 180;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const local: Array<[number, number]> = [
    [0, -h * 0.5],
    [w, -h * 0.5],
    [w, h * 0.5],
    [0, h * 0.5],
  ];
  return local.map(([px, py]) => {
    const sx = px * scaleX + py * tan;
    const sy = py;
    return {
      x: x + sx * c - sy * s,
      y: y + sx * s + sy * c,
    };
  });
}

function ghostAabb(
  x: number,
  y: number,
  fontSize: number,
  textLen: number,
  scaleX: number,
  rotate: number,
  skewX: number,
) {
  const pts = ghostCorners(x, y, fontSize, textLen, scaleX, rotate, skewX);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of pts) {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  return {minX, minY, maxX, maxY};
}

function fitGhostBox(
  x: number,
  y: number,
  fontSize: number,
  textLen: number,
  scaleX: number,
  rotate: number,
  skewX: number,
  width: number,
  height: number,
) {
  let nx = x;
  let ny = y;
  for (let i = 0; i < 2; i += 1) {
    const box = ghostAabb(nx, ny, fontSize, textLen, scaleX, rotate, skewX);
    if (box.minX < EDGE) {
      nx += EDGE - box.minX;
    }
    if (box.maxX > width - EDGE) {
      nx -= box.maxX - (width - EDGE);
    }
    if (box.minY < EDGE) {
      ny += EDGE - box.minY;
    }
    if (box.maxY > height - EDGE) {
      ny -= box.maxY - (height - EDGE);
    }
  }
  return {x: nx, y: ny};
}

function overlapsWelcome(
  x: number,
  y: number,
  fontSize: number,
  textLen: number,
  scaleX: number,
  rotate: number,
  skewX: number,
) {
  const box = welcomeBox();
  const aabb = ghostAabb(x, y, fontSize, textLen, scaleX, rotate, skewX);
  return !(
    aabb.maxX < box.left ||
    aabb.minX > box.right ||
    aabb.maxY < box.top ||
    aabb.minY > box.bottom
  );
}

function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}

function tooClose(x: number, y: number, recent: Point[]) {
  return recent.some((point) => Math.hypot(point.x - x, point.y - y) < NEAR);
}

function emptyGhost(): Ghost {
  return {
    active: false,
    kind: "streak",
    text: "",
    double: false,
    doubleX: 0,
    doubleY: 0,
    x: 0,
    y: 0,
    born: 0,
    appearMs: 100,
    holdMs: 600,
    exitMs: 300,
    maxOpacity: GHOST_OPACITY_MIN,
    fontSize: 11,
    scaleX: 1.2,
    rotate: 0,
    skewX: 0,
    blur: GHOST_BLUR_MIN,
    letterSpacing: GHOST_TRACKING_MIN,
    slideIn: 6,
    driftX: 0,
    driftY: 0,
    glitch: false,
    glitchAt: 0,
    glitchAmp: 0,
  };
}

export function GhostText() {
  const rootRef = useRef<HTMLDivElement>(null);
  const spansRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const spans = spansRef.current;
    const ghosts = Array.from({length: POOL}, emptyGhost);
    const recent: Point[] = [];
    let raf = 0;
    let mouseX = 0;
    let mouseY = 0;
    let lastX = 0;
    let lastY = 0;
    let hasPointer = false;
    let dirX = 1;
    let travel = 0;
    let threshold = range(70, 240);

    const place = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      let x = mouseX;
      let y = mouseY;

      for (let i = 0; i < PLACE_TRIES; i += 1) {
        if (rand() < 0.2) {
          x = range(EDGE, width - EDGE);
          y = range(EDGE, height - EDGE);
        } else {
          const back = range(40, 160) * (dirX >= 0 ? 1 : -1);
          const lift = (range(-180, 180) + range(-180, 180)) / 2;
          x = mouseX - back;
          y = mouseY + lift;
        }
        if (!tooClose(x, y, recent)) {
          break;
        }
      }

      return {x, y};
    };

    const spawn = (now: number) => {
      if (ghosts.filter((ghost) => ghost.active).length >= MAX_VISIBLE) {
        return;
      }
      const slot = ghosts.findIndex((ghost) => !ghost.active);
      if (slot < 0) {
        return;
      }

      const kind: GhostKind = rand() < 0.45 ? "streak" : "leak";
      const text =
        kind === "streak" ? composeStreak(mouseX, mouseY) : composeLeak();
      const fontSize = pickFontSize(kind);
      const scaleX = kind === "streak" ? range(1.15, 1.4) : range(1.08, 1.28);
      const width = window.innerWidth;
      const height = window.innerHeight;

      const settle = (start: Point) => {
        let tilt = tiltFromPosition(start.x, start.y, width, height);
        const fitted = fitGhostBox(
          start.x,
          start.y,
          fontSize,
          text.length,
          scaleX,
          tilt.rotate,
          tilt.skewX,
          width,
          height,
        );
        tilt = tiltFromPosition(fitted.x, fitted.y, width, height);
        return {point: fitted, tilt};
      };

      let placed = settle(place());
      let clear = !overlapsWelcome(
        placed.point.x,
        placed.point.y,
        fontSize,
        text.length,
        scaleX,
        placed.tilt.rotate,
        placed.tilt.skewX,
      );
      for (let i = 0; i < 8; i += 1) {
        if (clear) {
          break;
        }
        placed = settle(place());
        clear = !overlapsWelcome(
          placed.point.x,
          placed.point.y,
          fontSize,
          text.length,
          scaleX,
          placed.tilt.rotate,
          placed.tilt.skewX,
        );
      }
      if (!clear) {
        return;
      }

      const point = placed.point;
      const rotate = placed.tilt.rotate + range(-1, 1);
      const skewX = placed.tilt.skewX;

      const holdMs = range(700, 2400);
      const drift = range(6, 20);
      const ghost = ghosts[slot];
      if (!ghost) {
        return;
      }

      const ink = GHOST_COLOR;
      ghost.active = true;
      ghost.kind = kind;
      ghost.text = text;
      ghost.double = rand() < 0.25;
      ghost.doubleX = range(3, 8);
      ghost.doubleY = range(2, 4);
      ghost.x = point.x;
      ghost.y = point.y;
      ghost.born = now;
      ghost.appearMs = range(60, 180);
      ghost.holdMs = holdMs;
      ghost.exitMs = range(200, 600);
      ghost.maxOpacity = range(GHOST_OPACITY_MIN, GHOST_OPACITY_MAX);
      ghost.fontSize = fontSize;
      ghost.scaleX = scaleX;
      ghost.rotate = rotate;
      ghost.skewX = skewX;
      ghost.blur = range(GHOST_BLUR_MIN, GHOST_BLUR_MAX);
      ghost.letterSpacing = range(GHOST_TRACKING_MIN, GHOST_TRACKING_MAX);
      ghost.slideIn = range(4, 10) * (dirX >= 0 ? -1 : 1);
      ghost.driftX = dirX * drift;
      ghost.driftY = 0;
      ghost.glitch = rand() < 0.15;
      ghost.glitchAt = ghost.appearMs + range(0, Math.max(40, holdMs - 80));
      ghost.glitchAmp = range(5, 15) * (rand() < 0.5 ? -1 : 1);

      recent.push({x: point.x, y: point.y});
      if (recent.length > 4) {
        recent.shift();
      }
      publishGhostTick({
        x: window.innerWidth > 0 ? ghost.x / window.innerWidth : 0.5,
        size: ghost.fontSize,
      });

      const node = spans[slot];
      if (!node) {
        return;
      }
      const main = node.querySelector("[data-ghost-main]");
      const echo = node.querySelector("[data-ghost-echo]");
      if (main instanceof HTMLElement) {
        main.textContent = ghost.text;
        main.style.color = ink;
        main.style.textShadow = ghostStreakShadow();
        main.style.filter = `blur(${ghost.blur}px)`;
      }
      if (echo instanceof HTMLElement) {
        echo.textContent = ghost.text;
        echo.style.display = ghost.double ? "block" : "none";
        echo.style.transform = `translate(${ghost.doubleX}px, ${ghost.doubleY}px)`;
        echo.style.color = ink;
        echo.style.textShadow = ghostStreakShadow();
        echo.style.filter = `blur(${ghost.blur + 0.6}px)`;
        echo.style.opacity = "0.22";
      }
      node.style.fontSize = `${ghost.fontSize}px`;
      node.style.letterSpacing = `${ghost.letterSpacing}em`;
      node.style.color = ink;
      node.style.filter = "none";
      node.style.textShadow = "none";
    };

    const onPointerMove = (event: PointerEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!hasPointer) {
        lastX = mouseX;
        lastY = mouseY;
        hasPointer = true;
        return;
      }

      const dx = mouseX - lastX;
      const dy = mouseY - lastY;
      const dist = Math.hypot(dx, dy);
      lastX = mouseX;
      lastY = mouseY;
      if (dist < 0.45) {
        return;
      }

      const inv = 1 / dist;
      dirX = dx * inv;
      travel += dist;
      if (travel >= threshold) {
        travel = 0;
        threshold = range(70, 240);
        const now = performance.now();
        spawn(now);
        const energy = readMoireShare().energy;
        if (energy > 0.6 && rand() < 0.3) {
          spawn(now);
        }
      }
    };

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      const share = readMoireShare();
      const cx = share.hasPointer ? share.mouseX : mouseX;
      const cy = share.hasPointer ? share.mouseY : mouseY;
      const energy = share.hasPointer ? share.energy : 0;

      for (let i = 0; i < POOL; i += 1) {
        const ghost = ghosts[i];
        const node = spans[i];
        if (!ghost || !node) {
          continue;
        }
        if (!ghost.active) {
          node.style.visibility = "hidden";
          node.style.opacity = "0";
          continue;
        }

        const age = now - ghost.born;
        const appearEnd = ghost.appearMs;
        const holdEnd = appearEnd + ghost.holdMs;
        const exitEnd = holdEnd + ghost.exitMs;

        if (age >= exitEnd) {
          ghost.active = false;
          node.style.visibility = "hidden";
          node.style.opacity = "0";
          continue;
        }

        let opacity = ghost.maxOpacity;
        let ox = 0;
        let oy = 0;
        let blur = ghost.blur;

        if (age < appearEnd) {
          const t = easeOut(age / Math.max(appearEnd, 1));
          opacity *= t;
          ox = ghost.slideIn * (1 - t);
        } else if (age < holdEnd) {
          if (
            ghost.glitch &&
            age >= ghost.glitchAt &&
            age < ghost.glitchAt + 80
          ) {
            ox = ghost.glitchAmp;
          }
        } else {
          const t = (age - holdEnd) / Math.max(ghost.exitMs, 1);
          opacity *= 1 - t;
          ox = ghost.driftX * t;
          oy = ghost.driftY * t;
          blur = ghost.blur + t * 0.35;
        }

        const px = ghost.x + ox;
        const py = ghost.y + oy;
        const aabb = ghostAabb(
          px,
          py,
          ghost.fontSize,
          ghost.text.length,
          ghost.scaleX,
          ghost.rotate,
          ghost.skewX,
        );
        const gx = (aabb.minX + aabb.maxX) * 0.5;
        const gy = (aabb.minY + aabb.maxY) * 0.5;
        const dist = Math.hypot(cx - gx, cy - gy);
        const near = smoothstep(420, 120, dist);
        const reveal = 0.35 + 0.65 * near * (0.4 + 0.6 * energy);
        opacity *= reveal;

        ox += near * (Math.random() * 2 - 1) * energy * 3;
        if (
          overlapsWelcome(
            ghost.x + ox,
            ghost.y + oy,
            ghost.fontSize,
            ghost.text.length,
            ghost.scaleX,
            ghost.rotate,
            ghost.skewX,
          )
        ) {
          opacity = 0;
        }

        node.style.visibility = "visible";
        node.style.opacity = String(opacity);
        node.style.filter = "none";
        node.style.textShadow = "none";
        node.style.transform = `translate(${ghost.x + ox}px, ${ghost.y + oy}px) rotate(${ghost.rotate}deg) skewX(${ghost.skewX}deg) scaleX(${ghost.scaleX})`;
        const main = node.querySelector("[data-ghost-main]");
        if (main instanceof HTMLElement) {
          main.style.filter = `blur(${blur}px)`;
          main.style.textShadow = ghostStreakShadow();
        }
      }
    };

    window.addEventListener("pointermove", onPointerMove, {passive: true});
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`${vt323.variable} ${ibmPlexMono.variable}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9997,
        pointerEvents: "none",
        overflow: "visible",
        mixBlendMode: "normal",
        fontFamily:
          "var(--font-ghost-vt), var(--font-ghost-ibm), 'VT323', 'IBM Plex Mono', monospace",
        color: GHOST_COLOR,
      }}
    >
      {Array.from({length: POOL}, (_, index) => (
        <span
          key={index}
          ref={(node) => {
            spansRef.current[index] = node;
          }}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            padding: 0,
            overflow: "visible",
            visibility: "hidden",
            opacity: 0,
            whiteSpace: "nowrap",
            userSelect: "none",
            background: "none",
            border: "none",
            boxShadow: "none",
            mixBlendMode: GHOST_BLEND,
            willChange: "transform, opacity",
            transformOrigin: "left center",
          }}
        >
          <span data-ghost-main />
          <span
            data-ghost-echo
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              display: "none",
              opacity: 0.25,
              padding: 0,
              overflow: "visible",
              background: "none",
              border: "none",
              boxShadow: "none",
              textShadow: "none",
              filter: "blur(1.2px)",
            }}
          />
        </span>
      ))}
    </div>
  );
}
