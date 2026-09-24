import {RECALL, type RecallFace, type RecallGlyph} from "@/components/crt/crtRecall";
import {RECALL_MATTER} from "@/components/crt/crtRecallMatter";
import {RECALL_RETRO} from "@/components/crt/crtRecallRetro";

const cache = new Map<string, HTMLCanvasElement>();

export function clearRecallGlyphCache() {
  cache.clear();
}

function faceStack(face: RecallFace) {
  const host = document.querySelector(".crt-transit");
  const cs = host ? getComputedStyle(host) : getComputedStyle(document.documentElement);
  const cond = cs.getPropertyValue("--font-recall-cond").trim();
  const osw = cs.getPropertyValue("--font-recall-osw").trim();
  if (face === "raster") {
    return cond ? `${cond}, "Arial Narrow", sans-serif` : `"Barlow Condensed", "Arial Narrow", sans-serif`;
  }
  if (face === "display") {
    return cond
      ? `${cond}, ${osw || "Oswald"}, "Arial Narrow", sans-serif`
      : `"Barlow Condensed", "Arial Narrow", sans-serif`;
  }
  return cond ? `${cond}, "Arial Narrow", sans-serif` : `"Barlow Condensed", "Arial Narrow", sans-serif`;
}

function faceWeight(_face: RecallFace, weight: number) {
  return Math.max(400, Math.min(500, weight));
}

function scaleFor(size: number) {
  if (size >= RECALL.sizes.huge) {
    return {
      pixel: 1.12,
      cell: RECALL.cellHuge,
      bloom: 0.28,
      bloomPx: 4,
      offset: 1,
    };
  }
  if (size >= RECALL.sizes.medium) {
    return {
      pixel: RECALL.pixelMedium,
      cell: RECALL.cellMedium,
      bloom: RECALL.bloomMedium,
      bloomPx: 2.2,
      offset: 1,
    };
  }
  return {
    pixel: RECALL.pixelMeta,
    cell: RECALL.cellMeta,
    bloom: RECALL.bloomMeta,
    bloomPx: 1.4,
    offset: 1,
  };
}

function hash(seed: number, x: number, y: number) {
  let h = seed ^ (x * 374761393) ^ (y * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function tintMask(mask: HTMLCanvasElement, color: string) {
  const out = document.createElement("canvas");
  out.width = mask.width;
  out.height = mask.height;
  const ctx = out.getContext("2d");
  if (!ctx) {
    return out;
  }
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0);
  return out;
}

function expandMask(mask: HTMLCanvasElement, radius: number) {
  if (radius <= 0) {
    return mask;
  }
  const out = document.createElement("canvas");
  out.width = mask.width + radius * 2;
  out.height = mask.height + radius * 2;
  const ctx = out.getContext("2d");
  if (!ctx) {
    return mask;
  }
  ctx.imageSmoothingEnabled = false;
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y > radius * radius + 0.5) {
        continue;
      }
      ctx.drawImage(mask, radius + x, radius + y);
    }
  }
  return out;
}

function drawSolidGlyph(look: RecallGlyph, height: number) {
  const stack = faceStack(look.face);
  const weight = faceWeight(look.face, look.weight);
  const probe = document.createElement("canvas");
  probe.width = 8;
  probe.height = 8;
  const pctx = probe.getContext("2d");
  if (!pctx) {
    return document.createElement("canvas");
  }
  pctx.font = `${weight} ${height}px ${stack}`;
  pctx.textBaseline = "alphabetic";
  const metrics = pctx.measureText(look.ch);
  const stroke = Math.max(1, height * RECALL.strokeEm);
  const left = Math.ceil(Math.max(metrics.actualBoundingBoxLeft, 0) + stroke);
  const right = Math.ceil(Math.max(metrics.actualBoundingBoxRight, height * 0.4) + stroke);
  const asc = Math.ceil(Math.max(metrics.actualBoundingBoxAscent, height * 0.75) + stroke);
  const desc = Math.ceil(Math.max(metrics.actualBoundingBoxDescent, height * 0.12) + stroke);
  const srcW = Math.max(4, Math.ceil((left + right + 4) * Math.max(1, look.sx)));
  const srcH = Math.max(4, Math.ceil((asc + desc + 4) * Math.max(1, look.sy)));
  const src = document.createElement("canvas");
  src.width = srcW;
  src.height = srcH;
  const ctx = src.getContext("2d");
  if (!ctx) {
    return src;
  }
  ctx.font = `${weight} ${height}px ${stack}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.scale(look.sx, look.sy);
  const x = (left + 2) / look.sx;
  const y = (asc + 2) / look.sy;
  ctx.fillText(look.ch, x, y);
  return src;
}

function stairEdge(src: HTMLCanvasElement, seed: number) {
  const {width, height} = src;
  const ctx = src.getContext("2d");
  if (!ctx) {
    return src;
  }
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const copy = new Uint8ClampedArray(data);
  const jitter = RECALL.edgeJitter;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4 + 3;
      const on = copy[i] > 140;
      const n =
        (copy[i - 4] > 140 ? 1 : 0) +
        (copy[i + 4] > 140 ? 1 : 0) +
        (copy[i - width * 4] > 140 ? 1 : 0) +
        (copy[i + width * 4] > 140 ? 1 : 0);
      if (on && n <= 1 && hash(seed, x, y) < jitter) {
        data[i] = 0;
      } else if (on) {
        data[i] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return src;
}

function phosphorTexture(src: HTMLCanvasElement, cell: number) {
  const ctx = src.getContext("2d");
  if (!ctx) {
    return src;
  }
  const {width, height} = src;
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const strength = RECALL.gridStrength;
  const cellH = Math.max(2, cell * RECALL.cellRatio);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 20) {
        continue;
      }
      const triad = x % 3;
      const scan = 1 - strength * 0.22 * ((y % cellH) / cellH);
      data[i] = Math.round(data[i] * scan * (triad === 0 ? 1 : 1 - strength * 0.22));
      data[i + 1] = Math.round(data[i + 1] * scan * (triad === 1 ? 1 : 1 - strength * 0.14));
      data[i + 2] = Math.round(data[i + 2] * scan * (triad === 2 ? 1 : 1 - strength * 0.1));
    }
  }
  ctx.putImageData(img, 0, 0);
  return src;
}

function thresholdAlpha(canvas: HTMLCanvasElement, cutoff: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const ink = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pix = ink.data;
  for (let i = 3; i < pix.length; i += 4) {
    pix[i] = pix[i] > cutoff ? 255 : 0;
  }
  ctx.putImageData(ink, 0, 0);
  return canvas;
}

function buildMask(look: RecallGlyph, pixel: number) {
  const css = Math.max(12, look.size);
  const solid = drawSolidGlyph(look, css);
  stairEdge(solid, look.seed);
  if (pixel <= 1.08) {
    return thresholdAlpha(solid, 80);
  }
  const loW = Math.max(4, Math.round(solid.width / pixel));
  const loH = Math.max(4, Math.round(solid.height / pixel));
  const lo = document.createElement("canvas");
  lo.width = loW;
  lo.height = loH;
  const lctx = lo.getContext("2d");
  if (!lctx) {
    return thresholdAlpha(solid, 80);
  }
  lctx.imageSmoothingEnabled = false;
  lctx.drawImage(solid, 0, 0, loW, loH);
  thresholdAlpha(lo, 88);
  const hi = document.createElement("canvas");
  hi.width = solid.width;
  hi.height = solid.height;
  const hctx = hi.getContext("2d");
  if (!hctx) {
    return lo;
  }
  hctx.imageSmoothingEnabled = false;
  hctx.drawImage(lo, 0, 0, hi.width, hi.height);
  return thresholdAlpha(hi, 80);
}

function renderGlyph(look: RecallGlyph) {
  if (look.ch === " ") {
    const gap = document.createElement("canvas");
    gap.width = Math.max(2, Math.round(look.size * 0.34));
    gap.height = Math.max(2, Math.round(look.size * 0.2));
    return gap;
  }
  const scale = scaleFor(look.size);
  const mask = buildMask(look, scale.pixel);
  const soft = Math.max(0, look.soft);
  const pad = Math.ceil(soft + RECALL_MATTER.registerPx + 3);
  const out = document.createElement("canvas");
  out.width = mask.width + pad * 2;
  out.height = mask.height + pad * 2;
  const ctx = out.getContext("2d");
  if (!ctx) {
    return out;
  }
  const fill = look.ghost
    ? RECALL_RETRO.ghostFill
    : look.ink === "amber"
      ? RECALL_MATTER.amber
      : RECALL_MATTER.pale;
  const core = tintMask(mask, fill);
  const pink = tintMask(mask, RECALL_MATTER.pink);
  const cyan = tintMask(mask, RECALL_MATTER.cyan);
  const shift = RECALL_MATTER.registerPx * (look.boxed ? 0.65 : 1);
  const register = RECALL_MATTER.registerAlpha * (look.boxed ? 0.55 : 1);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = register;
  ctx.drawImage(pink, pad - shift, pad);
  ctx.drawImage(cyan, pad + shift, pad);
  ctx.save();
  ctx.filter = soft > 0.04 ? `blur(${soft}px)` : "none";
  ctx.globalAlpha = 1;
  ctx.drawImage(core, pad, pad);
  ctx.restore();
  phosphorTexture(out, scale.cell);
  return out;
}

export function rasterRecallGlyph(look: RecallGlyph) {
  const key = [
    look.ch,
    look.face,
    look.size.toFixed(1),
    look.sx.toFixed(3),
    look.sy.toFixed(3),
    look.weight,
    look.ink,
    look.boxed ? "b" : "o",
    look.ghost ? "g" : "l",
    look.soft.toFixed(2),
    look.pinkDx.toFixed(2),
    look.pinkDy.toFixed(2),
    look.greenDx.toFixed(2),
    look.greenDy.toFixed(2),
    look.bloom.toFixed(2),
    look.seed,
  ].join("|");
  let src = cache.get(key);
  if (!src) {
    src = renderGlyph(look);
    cache.set(key, src);
  }
  if (!src.parentNode) {
    return src;
  }
  const copy = document.createElement("canvas");
  copy.width = src.width;
  copy.height = src.height;
  copy.getContext("2d")?.drawImage(src, 0, 0);
  return copy;
}
