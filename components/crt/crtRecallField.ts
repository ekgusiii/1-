import {
  RECALL_MATTER,
  recallGrainAlpha,
  recallVignette,
} from "@/components/crt/crtRecallMatter";
import {RECALL_RETRO, retroRollY} from "@/components/crt/crtRecallRetro";

let grainTile: HTMLCanvasElement | null = null;

function resize(canvas: HTMLCanvasElement, cssW: number, cssH: number, scale: number) {
  const w = Math.max(2, Math.round(cssW * scale));
  const h = Math.max(2, Math.round(cssH * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  return {w, h};
}

function makeGrain() {
  if (grainTile) {
    return grainTile;
  }
  const size = RECALL_MATTER.grainTile;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext("2d");
  if (!ctx) {
    return tile;
  }
  const img = ctx.createImageData(size, size);
  const pix = img.data;
  for (let i = 0; i < pix.length; i += 4) {
    const n = 80 + Math.floor(Math.random() * 140);
    pix[i] = n;
    pix[i + 1] = n;
    pix[i + 2] = n;
    pix[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainTile = tile;
  return tile;
}

function paintField(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5;
  const cy = h * 0.46;
  const r = Math.hypot(w, h) * 0.62;
  const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  wash.addColorStop(0, RECALL_MATTER.fieldCenter);
  wash.addColorStop(0.52, RECALL_MATTER.fieldMid);
  wash.addColorStop(1, RECALL_MATTER.fieldDeep);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
}

function paintVignette(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ];
  const reach = Math.min(w, h) * 0.62;
  for (const [x, y] of corners) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
    g.addColorStop(0, `rgba(0, 0, 0, ${alpha + RECALL_RETRO.cornerExtra})`);
    g.addColorStop(0.7, `rgba(0, 0, 0, ${alpha * 0.35})`);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function paintScan(ctx: CanvasRenderingContext2D, w: number, h: number, cssH: number, t: number) {
  const step = Math.max(1, Math.round(h / (cssH / RECALL_MATTER.scanStepCss)));
  const alpha = RECALL_MATTER.scanAlpha;
  for (let y = 0; y < h; y += step) {
    const wobble = 0.82 + 0.18 * Math.sin(y * 0.21 + t * 0.00035);
    ctx.fillStyle = `rgba(0, 4, 18, ${alpha * wobble})`;
    ctx.fillRect(0, y, w, 1);
  }
}

function paintGrain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const tile = makeGrain();
  const drift = (t * RECALL_MATTER.grainSpeed) % tile.width;
  ctx.save();
  ctx.globalAlpha = recallGrainAlpha(t);
  ctx.globalCompositeOperation = "soft-light";
  const ox = -Math.floor(drift);
  const oy = -Math.floor(drift * 0.37);
  for (let y = oy; y < h; y += tile.height) {
    for (let x = ox; x < w; x += tile.width) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.restore();
}

export function paintRecallField(
  field: HTMLCanvasElement,
  glass: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  t: number,
  look: {field: number; scan: number; blend: "multiply" | "color" | "normal"} = {
    field: 1,
    scan: 0.07,
    blend: "normal",
  },
) {
  if (look.field <= 0.001 && look.scan <= 0.001) {
    field.style.opacity = "0";
    field.style.mixBlendMode = "normal";
    glass.style.opacity = "0";
    return 0;
  }
  field.style.opacity = String(look.field);
  field.style.mixBlendMode = look.field > 0.001 ? look.blend : "normal";
  glass.style.opacity =
    look.field > 0.001
      ? String(look.field)
      : String(Math.min(1, look.scan / RECALL_MATTER.scanAlpha));

  if (look.field > 0.001) {
    const lo = resize(field, cssW, cssH, 0.5);
    const ctx = field.getContext("2d");
    if (!ctx) {
      return 0;
    }
    paintField(ctx, lo.w, lo.h);
  }

  const hi = resize(glass, cssW, cssH, Math.min(1.25, window.devicePixelRatio || 1));
  const gtx = glass.getContext("2d");
  if (!gtx) {
    return 0;
  }
  gtx.clearRect(0, 0, hi.w, hi.h);
  if (look.field > 0.001) {
    paintVignette(gtx, hi.w, hi.h, recallVignette(t));
    paintGrain(gtx, hi.w, hi.h, t);
  }
  paintScan(gtx, hi.w, hi.h, cssH, t);
  if (look.field > 0.001 && t >= 0) {
    const band = hi.h * RECALL_RETRO.rollH;
    const y = retroRollY(t, hi.h);
    const wash = gtx.createLinearGradient(0, y, 0, y + band);
    wash.addColorStop(0, "rgba(220, 230, 255, 0)");
    wash.addColorStop(0.42, `rgba(220, 230, 255, ${RECALL_RETRO.rollAlpha})`);
    wash.addColorStop(0.58, `rgba(220, 230, 255, ${RECALL_RETRO.rollAlpha})`);
    wash.addColorStop(1, "rgba(220, 230, 255, 0)");
    gtx.save();
    gtx.globalCompositeOperation = "screen";
    gtx.fillStyle = wash;
    gtx.fillRect(0, y, hi.w, band);
    gtx.restore();
  }
  return 0;
}
