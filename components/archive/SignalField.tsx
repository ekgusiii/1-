"use client";

import {useEffect, useRef} from "react";

import {ARCHIVE, mulberry32, randInt, randRange} from "@/components/archive/archiveConfig";

export type SignalGlitch = {
  bands: Array<{y: number; h: number; x: number}>;
  rgb: number;
  roll: number;
  brightness: number;
};

type Segment = {
  x: number;
  w: number;
  r: number;
  g: number;
  b: number;
  a: number;
};

type Row = {
  y: number;
  h: number;
  bright: boolean;
  segments: Segment[];
  sparks: Array<{x: number; a: number}>;
  slip: number;
  slipTo: number;
};

const TEAL = [
  [47, 214, 176],
  [31, 168, 138],
  [42, 200, 164],
] as const;
const MAGENTA = [[194, 58, 138], [176, 42, 122]] as const;
const BLUE = [[42, 60, 176], [32, 48, 150]] as const;
const RED = [179, 48, 42] as const;
const VOID = "#050608";

function pickColor(rng: () => number, bright: boolean) {
  const roll = rng();
  if (roll < (bright ? 0.68 : 0.48)) {
    return TEAL[Math.floor(rng() * TEAL.length)] ?? TEAL[0];
  }
  if (roll < 0.84) {
    return MAGENTA[Math.floor(rng() * MAGENTA.length)] ?? MAGENTA[0];
  }
  return BLUE[Math.floor(rng() * BLUE.length)] ?? BLUE[0];
}

function makeSegments(
  rng: () => number,
  width: number,
  bright: boolean,
): Segment[] {
  const segs: Segment[] = [];
  let x = 0;
  while (x < width) {
    if (rng() < 0.13) {
      x += randRange(rng, 2, 14);
      continue;
    }
    const kind = rng();
    let w = 4;
    if (kind < 0.2) {
      w = randRange(rng, 1, 5);
    } else if (kind < 0.52) {
      w = randRange(rng, 8, 36);
    } else if (kind < 0.84) {
      w = randRange(rng, 36, width * 0.26);
    } else {
      w = randRange(rng, width * 0.28, width * 0.52);
    }
    const [r, g, b] = pickColor(rng, bright);
    segs.push({
      x,
      w,
      r,
      g,
      b,
      a: bright ? randRange(rng, 0.58, 1) : randRange(rng, 0.32, 0.7),
    });
    x += w + randRange(rng, 0, 6);
  }
  return segs;
}

function makeSparks(rng: () => number, width: number, count: number) {
  return Array.from({length: count}, () => ({
    x: rng() * width,
    a: randRange(rng, 0.35, 0.95),
  }));
}

function makeRow(
  rng: () => number,
  width: number,
  y: number,
  h: number,
  bright: boolean,
): Row {
  return {
    y,
    h,
    bright,
    segments: makeSegments(rng, width, bright),
    sparks: makeSparks(rng, width, bright ? randInt(rng, 0, 3) : randInt(rng, 0, 2)),
    slip: 0,
    slipTo: 0,
  };
}

function packRows(rng: () => number, width: number, height: number): Row[] {
  const rows: Row[] = [];
  let y = 0;
  let bright = rng() < 0.55;
  while (y < height) {
    if (rng() < 0.28) {
      bright = !bright;
    }
    const pack = randInt(rng, 3, 8);
    for (let i = 0; i < pack && y < height; i += 1) {
      const h = Math.min(randInt(rng, 1, 3), height - y);
      rows.push(makeRow(rng, width, y, h, bright));
      y += h;
    }
    if (rng() < 0.18) {
      bright = !bright;
    }
  }
  return rows;
}

function hash01(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function paintRow(
  ctx: CanvasRenderingContext2D,
  row: Row,
  width: number,
  height: number,
  live: number,
  salt: number,
) {
  ctx.fillStyle = VOID;
  ctx.fillRect(0, row.y, width, row.h);

  const mid = 1 - Math.abs(row.y / Math.max(height, 1) - 0.5) * 2;
  const lift = 1 + 0.2 * mid * mid;
  const ox = row.slip;
  let bit = salt + row.y * 13.7;

  for (const seg of row.segments) {
    const end = seg.x + seg.w;
    let x = seg.x;
    while (x < end) {
      bit += 1.618;
      const t = (x - seg.x) / Math.max(seg.w, 1);
      const edge = Math.min(t, 1 - t);
      const sparse = edge < 0.2 ? 0.28 + (edge / 0.2) * 0.62 : 1;
      if (hash01(bit) < 0.11) {
        x += 1 + hash01(bit + 3) * 2;
        continue;
      }
      if (hash01(bit + 8) > sparse * 0.94) {
        x += 1;
        continue;
      }
      const dash = hash01(bit + 2) < 0.55 ? 1 : 2;
      const flicker = 0.62 + hash01(bit + 5) * 0.5;
      const a = Math.min(1, seg.a * live * lift * flicker);
      ctx.fillStyle = `rgba(${seg.r},${seg.g},${seg.b},${a * 0.35})`;
      ctx.fillRect(x + ox - 1, row.y, dash + 2, row.h);
      ctx.fillStyle = `rgba(${seg.r},${seg.g},${seg.b},${a})`;
      ctx.fillRect(x + ox, row.y, dash, row.h);
      x += dash;
    }
  }

  for (const spark of row.sparks) {
    ctx.fillStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${spark.a * live * lift})`;
    ctx.fillRect(spark.x + ox, row.y, 1, Math.max(1, row.h - 0.2));
  }
}

type SignalFieldProps = {
  intensity: number;
  glitch: SignalGlitch | null;
};

export function SignalField({intensity, glitch}: SignalFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);
  const glitchRef = useRef(glitch);
  intensityRef.current = intensity;
  glitchRef.current = glitch;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d", {alpha: false});
    if (!ctx) {
      return;
    }

    const rng = mulberry32(0x51f1e1d);
    let cssW = 1;
    let cssH = 1;
    let bufW = 1;
    let bufH = 1;
    let rows: Row[] = [];
    let raf = 0;
    let off: HTMLCanvasElement | null = null;
    let offCtx: CanvasRenderingContext2D | null = null;
    let nextSlip = 1200;
    let elapsed = 0;
    let last = 0;
    let slipping: Row[] = [];
    let salt = 1;

    const paintAll = (target: CanvasRenderingContext2D) => {
      target.fillStyle = VOID;
      target.fillRect(0, 0, bufW, bufH);
      const live = intensityRef.current;
      for (const row of rows) {
        paintRow(target, row, bufW, bufH, live, salt);
      }
    };

    const rebuild = () => {
      rows = packRows(rng, bufW, bufH);
      slipping = [];
    };

    const resize = () => {
      cssW = window.innerWidth;
      cssH = window.visualViewport?.height ?? window.innerHeight;
      bufW = Math.max(1, Math.floor(cssW * ARCHIVE.signalBuffer));
      bufH = Math.max(1, Math.floor(cssH * ARCHIVE.signalBuffer));
      canvas.width = bufW;
      canvas.height = bufH;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.imageRendering = "auto";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      off = document.createElement("canvas");
      off.width = bufW;
      off.height = bufH;
      offCtx = off.getContext("2d", {alpha: false});
      offCtx?.setTransform(1, 0, 0, 1, 0, 0);
      rebuild();
      paintAll(ctx);
    };

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      elapsed += dt * 1000;
      const live = intensityRef.current;
      const g = glitchRef.current;

      const dirty = new Set<number>();
      const n = Math.max(3, Math.floor(rows.length * 0.045));
      for (let i = 0; i < n; i += 1) {
        const idx = randInt(rng, 0, rows.length - 1);
        const row = rows[idx];
        if (!row) {
          continue;
        }
        row.segments = makeSegments(rng, bufW, row.bright);
        row.sparks = makeSparks(rng, bufW, row.bright ? randInt(rng, 0, 3) : randInt(rng, 0, 2));
        salt += 1;
        dirty.add(idx);
      }

      if (elapsed >= nextSlip) {
        nextSlip = elapsed + randRange(rng, 1000, 2000);
        slipping.forEach((row) => {
          row.slipTo = 0;
        });
        slipping = [];
        const count = randInt(rng, 4, 9);
        for (let i = 0; i < count; i += 1) {
          const row = rows[randInt(rng, 0, rows.length - 1)];
          if (!row) {
            continue;
          }
          row.slipTo = randRange(rng, -42, 42);
          slipping.push(row);
        }
      }

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row) {
          continue;
        }
        const dest = row.slipTo;
        const nextSlipX = row.slip + (dest - row.slip) * 0.28;
        if (Math.abs(nextSlipX - row.slip) > 0.05 || Math.abs(row.slip) > 0.05) {
          row.slip = nextSlipX;
          if (Math.abs(row.slip - dest) < 0.4 && dest !== 0) {
            row.slipTo = 0;
          }
          dirty.add(i);
        }
      }

      if (g && off && offCtx) {
        paintAll(offCtx);
        const s = ARCHIVE.signalBuffer;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = VOID;
        ctx.fillRect(0, 0, bufW, bufH);
        ctx.translate(0, g.roll * s);
        ctx.filter = `brightness(${g.brightness})`;
        if (g.bands.length === 0) {
          ctx.drawImage(off, 0, 0);
        } else {
          for (const band of g.bands) {
            ctx.drawImage(
              off,
              0,
              band.y * s,
              bufW,
              band.h * s,
              band.x * s,
              band.y * s,
              bufW,
              band.h * s,
            );
          }
        }
        if (g.rgb > 0.5) {
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = 0.55;
          ctx.drawImage(off, -g.rgb * s, 0);
          ctx.drawImage(off, g.rgb * s, 0);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.restore();
        return;
      }

      if (live <= 0.01) {
        ctx.fillStyle = VOID;
        ctx.fillRect(0, 0, bufW, bufH);
        return;
      }

      for (const idx of dirty) {
        const row = rows[idx];
        if (row) {
          paintRow(ctx, row, bufW, bufH, live, salt);
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="arc-signal" aria-hidden />;
}

export function makeGlitchBands(
  rng: () => number,
  height: number,
): SignalGlitch["bands"] {
  const count = randInt(rng, ARCHIVE.bandMin, ARCHIVE.bandMax);
  const cuts = [0];
  for (let i = 1; i < count; i += 1) {
    cuts.push(randRange(rng, 0.04, 0.96));
  }
  cuts.push(1);
  cuts.sort((a, b) => a - b);
  const bands: SignalGlitch["bands"] = [];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const y = cuts[i] * height;
    const next = cuts[i + 1] * height;
    bands.push({
      y,
      h: Math.max(2, next - y),
      x: randRange(rng, -ARCHIVE.bandShiftMax, ARCHIVE.bandShiftMax),
    });
  }
  return bands;
}
