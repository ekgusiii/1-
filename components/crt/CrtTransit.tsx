"use client";

import {useEffect, useMemo, useRef, type RefObject} from "react";
import {Barlow_Condensed, Oswald} from "next/font/google";

import {publishTransitShare} from "@/lib/moireShare";
import {buildRecallPool, type RecallGhost, type RecallGlyph, type RecallView} from "@/components/crt/crtRecall";
import {paintRecallField} from "@/components/crt/crtRecallField";
import {
  RECALL_MATTER,
  recallFlicker,
  recallGlow,
  recallGlowFilter,
  recallHitchY,
} from "@/components/crt/crtRecallMatter";
import {RECALL_RETRO, recallBarrelMap} from "@/components/crt/crtRecallRetro";
import {clearRecallGlyphCache, rasterRecallGlyph} from "@/components/crt/crtRecallGlyph";
import {
  TRANSIT,
  armTransitHitches,
  resolveTransit,
  transitLeadMs,
  type TransitStill,
} from "@/components/crt/crtTransit";
import type {Project} from "@/sanity/lib/queries";

import "./crtTransit.css";

const recallCond = Barlow_Condensed({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-recall-cond",
});

const recallOsw = Oswald({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-recall-osw",
});

type CrtTransitProps = {
  plate: HTMLCanvasElement | null;
  bounds: {minX: number; maxX: number; minY: number; maxY: number} | null;
  projects: Project[];
  exitRef: RefObject<HTMLElement | null>;
  onDone: () => void;
};

function paintCh(glyph: RecallGlyph) {
  const mark = document.createElement("span");
  mark.className = "crt-transit__ch";
  mark.dataset.face = glyph.face;
  mark.dataset.ink = glyph.ink;
  mark.style.opacity = String(glyph.fade);
  mark.style.transform = `translateY(${glyph.dy}em)`;
  mark.style.marginRight = `${glyph.track}em`;
  mark.append(rasterRecallGlyph(glyph));
  return mark;
}

function paintGhost(ghost: RecallGhost, left: number) {
  const node = document.createElement("span");
  node.className = left === 0 ? "crt-transit__ghost" : "crt-transit__ghost-abs";
  node.style.opacity = String(ghost.opacity);
  if (left !== 0) {
    node.style.left = `${left}px`;
  }
  node.append(paintCh(ghost.glyph));
  return node;
}

function paintFrag(frag: RecallView) {
  const node = document.createElement("p");
  node.className = "crt-transit__frag";
  node.dataset.anchor = frag.anchor;
  if (frag.step) {
    node.dataset.step = "1";
  }
  if (frag.mark) {
    node.dataset.mark = "1";
    node.style.setProperty("--mark-w", `${frag.markW}px`);
    node.style.setProperty("--mark-h", `${frag.markH}px`);
    const bar = document.createElement("span");
    bar.className = "crt-transit__mark";
    bar.style.opacity = String(frag.markAlpha);
    bar.style.transform = `translateY(${frag.id.charCodeAt(0) % 3 === 0 ? -1 : 1}px)`;
    node.append(bar);
  }
  node.style.left = `${frag.x}vw`;
  node.style.top = `${frag.y}vh`;
  node.style.fontSize = `${frag.size}px`;
  node.style.opacity = String(frag.opacity);
  const row = document.createElement("span");
  row.className = "crt-transit__row";
  row.style.filter = recallGlowFilter(frag.size, frag.mark);
  const slotW = Math.max(8, frag.size * (0.52 + frag.track * 0.35));
  const ghostsAt = new Map<number, RecallGhost[]>();
  for (const ghost of frag.ghosts) {
    const list = ghostsAt.get(ghost.index) ?? [];
    list.push(ghost);
    ghostsAt.set(ghost.index, list);
  }
  if (frag.glyphs.length) {
    for (let i = 0; i < frag.glyphs.length; i += 1) {
      const index = frag.liveA + i;
      const slot = document.createElement("span");
      slot.className = "crt-transit__slot";
      for (const ghost of ghostsAt.get(index) ?? []) {
        slot.append(paintGhost(ghost, 0));
      }
      slot.append(paintCh(frag.glyphs[i]));
      row.append(slot);
    }
    for (const ghost of frag.ghosts) {
      if (ghost.index >= frag.liveA && ghost.index < frag.liveB) {
        continue;
      }
      row.append(paintGhost(ghost, (ghost.index - frag.liveA) * slotW));
    }
  } else {
    const ordered = [...frag.ghosts].sort((a, b) => a.index - b.index);
    for (const ghost of ordered) {
      const slot = document.createElement("span");
      slot.className = "crt-transit__slot";
      slot.append(paintGhost(ghost, 0));
      row.append(slot);
    }
  }
  if (frag.cursor?.on) {
    const caret = document.createElement("span");
    caret.className = "crt-transit__caret";
    caret.style.left = `${(frag.cursor.index - (frag.glyphs.length ? frag.liveA : 0)) * slotW}px`;
    caret.style.setProperty("--recall-caret-w", `${RECALL_RETRO.cursorW}em`);
    caret.style.setProperty("--recall-caret-h", `${RECALL_RETRO.cursorH}em`);
    caret.style.setProperty(
      "--recall-caret-fill",
      frag.glyphs[0]?.ink === "amber" || frag.id === "sel" ? RECALL_MATTER.amber : RECALL_MATTER.pale,
    );
    const glow = recallGlow(frag.size, frag.mark);
    caret.style.boxShadow = `0 0 ${glow.inner}px rgba(220,235,255,${glow.innerA}), 0 0 ${glow.outer}px rgba(170,200,255,${glow.outerA})`;
    row.append(caret);
  }
  node.append(row);
  return node;
}

function paintStill(
  dst: HTMLCanvasElement,
  plate: HTMLCanvasElement,
  still: TransitStill,
  cssW: number,
  cssH: number,
) {
  if (dst.width !== cssW || dst.height !== cssH) {
    dst.width = cssW;
    dst.height = cssH;
  }
  const ctx = dst.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, cssW, cssH);
  if (!still.show || still.opacity <= 0.001) {
    return;
  }
  const grade = `saturate(${still.sat}) contrast(${still.contrast}) brightness(${still.bright}) sepia(${still.sepia})`;
  if (still.bloomAlpha > 0.001) {
    ctx.save();
    ctx.filter = `${grade} blur(${still.bloomPx}px)`;
    ctx.globalAlpha = still.opacity * still.bloomAlpha;
    ctx.drawImage(plate, 0, 0, cssW, cssH);
    ctx.restore();
  }
  ctx.save();
  ctx.filter = still.blur > 0.05 ? `${grade} blur(${still.blur}px)` : grade;
  ctx.globalAlpha = still.opacity;
  ctx.drawImage(plate, 0, 0, cssW, cssH);
  ctx.restore();
  if (still.band) {
    const y = still.band.y * cssH;
    const h = still.band.h;
    ctx.save();
    ctx.filter = grade;
    ctx.globalAlpha = still.opacity;
    ctx.drawImage(plate, 0, y, cssW, h, still.band.dx, y, cssW, h);
    ctx.restore();
  }
}

export function CrtTransit({
  plate,
  projects,
  onDone,
}: CrtTransitProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stillRef = useRef<HTMLCanvasElement>(null);
  const fragRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const glassRef = useRef<HTMLCanvasElement>(null);
  const tubeRef = useRef<HTMLDivElement>(null);
  const barrelRef = useRef<SVGFEDisplacementMapElement>(null);
  const barrelImgRef = useRef<SVGFEImageElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const pool = useMemo(() => buildRecallPool(projects), [projects]);
  const poolRef = useRef(pool);
  poolRef.current = pool;
  const plateRef = useRef(plate);
  plateRef.current = plate;

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let finished = false;
    let skipAt: number | null = null;
    armTransitHitches();
    if (barrelImgRef.current) {
      const map = recallBarrelMap();
      barrelImgRef.current.setAttribute("href", map);
      barrelImgRef.current.setAttributeNS("http://www.w3.org/1999/xlink", "href", map);
    }

    publishTransitShare({
      timeScale: 0,
      interact: false,
      scanBoost: 0,
      hideText: false,
    });

    const paint = (now: number) => {
      if (finished) {
        return;
      }
      const lead = transitLeadMs();
      const ms =
        skipAt !== null
          ? lead + TRANSIT.fragMs + Math.min(TRANSIT.silenceMs, now - skipAt)
          : now - start;
      const frame = resolveTransit(ms, poolRef.current);
      const hasPlate = Boolean(plateRef.current);
      publishTransitShare({
        timeScale: 0,
        interact: false,
        hideText: hasPlate || frame.hideShaderText,
        scanBoost: 0,
      });

      const cssW = window.innerWidth;
      const cssH = window.innerHeight;
      const stillNode = stillRef.current;
      if (stillNode && plateRef.current) {
        stillNode.style.transform = `translateY(${frame.still.dy}px)`;
        stillNode.style.opacity = frame.still.show ? "1" : "0";
        paintStill(stillNode, plateRef.current, frame.still, cssW, cssH);
      }

      const recallT = frame.stage === "frag" ? ms - lead : frame.stage === "silence" ? TRANSIT.fragMs : 0;
      const field = fieldRef.current;
      const glass = glassRef.current;
      if (field && glass) {
        paintRecallField(field, glass, cssW, cssH, recallT, {
          field: frame.still.field,
          scan: frame.still.scan,
          blend: frame.still.fieldBlend,
        });
        field.style.transform = "";
        field.style.filter = "";
        glass.style.transform = "";
      }

      const root = rootRef.current;
      if (root) {
        const live = frame.still.field > 0.2;
        root.style.filter = live ? `brightness(${recallFlicker(recallT)})` : "";
        const hitch = live ? recallHitchY(recallT) : 0;
        root.style.transform = hitch ? `translateY(${hitch}px)` : "";
        root.style.setProperty("--recall-mark-fill", RECALL_MATTER.markFill);
        root.style.setProperty("--recall-mark-inset", RECALL_MATTER.markInset);
        root.style.setProperty("--recall-mark-blur", `${RECALL_MATTER.markBlur}px`);
        root.style.setProperty("--recall-radius", String(RECALL_RETRO.radius));
      }
      const tube = tubeRef.current;
      if (tube) {
        const warp = frame.still.field > 0.45;
        tube.style.filter = warp ? "url(#recall-barrel)" : "";
      }
      if (barrelRef.current) {
        barrelRef.current.setAttribute(
          "scale",
          String(Math.round(Math.min(cssW, cssH) * RECALL_RETRO.barrel)),
        );
      }
      if (barrelImgRef.current && !barrelImgRef.current.getAttribute("href")) {
        barrelImgRef.current.setAttribute("href", recallBarrelMap());
      }

      const frags = fragRef.current;
      if (frags) {
        frags.replaceChildren();
        for (const frag of frame.frags) {
          frags.append(paintFrag(frag));
        }
      }

      if (frame.done) {
        finished = true;
        doneRef.current();
        return;
      }

      raf = window.requestAnimationFrame(paint);
    };

    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 200);
    const onSkip = () => {
      if (!armed || skipAt !== null || finished) {
        return;
      }
      skipAt = performance.now();
    };

    void document.fonts.ready.then(() => {
      clearRecallGlyphCache();
    });
    raf = window.requestAnimationFrame(paint);
    window.addEventListener("click", onSkip);
    return () => {
      window.clearTimeout(arm);
      window.cancelAnimationFrame(raf);
      window.removeEventListener("click", onSkip);
      publishTransitShare({
        timeScale: 1,
        interact: true,
        hideText: false,
        scanBoost: 0,
      });
    };
  }, []);

  return (
    <div ref={rootRef} className={`crt-transit ${recallCond.variable} ${recallOsw.variable}`}>
      <svg className="crt-transit__svg" aria-hidden>
        <filter id="recall-barrel" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feImage ref={barrelImgRef} result="map" preserveAspectRatio="none" />
          <feDisplacementMap
            ref={barrelRef}
            in="SourceGraphic"
            in2="map"
            xChannelSelector="R"
            yChannelSelector="G"
            scale="8"
          />
        </filter>
      </svg>
      <div ref={tubeRef} className="crt-transit__tube">
        <canvas ref={stillRef} className="crt-transit__still" aria-hidden />
        <canvas ref={fieldRef} className="crt-transit__field" aria-hidden />
        <div ref={fragRef} className="crt-transit__frags" />
        <canvas ref={glassRef} className="crt-transit__glass" aria-hidden />
      </div>
    </div>
  );
}
