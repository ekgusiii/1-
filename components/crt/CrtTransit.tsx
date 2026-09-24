"use client";

import {useEffect, useMemo, useRef, type RefObject} from "react";
import {Barlow_Condensed, Oswald} from "next/font/google";

import {publishTransitShare} from "@/lib/moireShare";
import {buildRecallPool} from "@/components/crt/crtRecall";
import {clearRecallGlyphCache, rasterRecallGlyph} from "@/components/crt/crtRecallGlyph";
import {
  TRANSIT,
  colorFilter,
  keyWelcomePlate,
  resolveTransit,
  sliceGlyphs,
  type GlyphSlice,
  type TextBounds,
} from "@/components/crt/crtTransit";
import type {Project} from "@/sanity/lib/queries";

import "./crtTransit.css";

const recallCond = Barlow_Condensed({
  weight: ["500", "600"],
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
  bounds: TextBounds | null;
  projects: Project[];
  exitRef: RefObject<HTMLElement | null>;
  onDone: () => void;
};

function applyGrade(exit: HTMLElement | null, filter: string, active: boolean) {
  if (!exit) {
    return;
  }
  exit.style.filter = active ? filter : "";
}

export function CrtTransit({
  plate,
  bounds,
  projects,
  exitRef,
  onDone,
}: CrtTransitProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fragRef = useRef<HTMLDivElement>(null);
  const slicesRef = useRef<GlyphSlice[] | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const pool = useMemo(() => buildRecallPool(projects), [projects]);
  const poolRef = useRef(pool);
  poolRef.current = pool;

  useEffect(() => {
    if (!plate || !bounds || slicesRef.current) {
      return;
    }
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const keyed = keyWelcomePlate(plate, bounds);
    slicesRef.current = sliceGlyphs(keyed, bounds, cssW, cssH);
  }, [plate, bounds]);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let finished = false;
    let skipAt: number | null = null;

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
      const ms =
        skipAt !== null
          ? TRANSIT.freezeMs +
            TRANSIT.colorMs +
            TRANSIT.typeMs +
            TRANSIT.deleteMs +
            TRANSIT.fragMs +
            Math.min(TRANSIT.silenceMs, now - skipAt)
          : now - start;
      const frame = resolveTransit(ms, poolRef.current);
      publishTransitShare({
        timeScale: 0,
        interact: false,
        hideText: frame.hideShaderText,
      });
      applyGrade(
        exitRef.current,
        colorFilter(frame.color),
        frame.stage !== "freeze" && frame.stage !== "done",
      );

      const host = hostRef.current;
      if (host) {
        host.replaceChildren();
        if (
          (frame.stage === "type" || frame.stage === "delete") &&
          slicesRef.current
        ) {
          frame.glyphs.forEach((glyph, index) => {
            const slice = slicesRef.current?.[index];
            if (!slice || glyph.hidden) {
              return;
            }
            const wrap = document.createElement("div");
            wrap.className = "crt-transit__glyph";
            wrap.style.left = `${slice.left}px`;
            wrap.style.top = `${slice.top}px`;
            wrap.style.width = `${slice.width}px`;
            wrap.style.height = `${slice.height * glyph.clip}px`;
            wrap.style.opacity = String(glyph.opacity);
            wrap.style.transform = `translate(${glyph.dx}px, ${glyph.dy}px) rotate(${glyph.rot}deg) scale(${glyph.sx}, ${glyph.sy})`;
            if (glyph.ch !== TRANSIT.letters[index]) {
              const mark = document.createElement("span");
              mark.className = "crt-transit__swap";
              mark.textContent = glyph.ch;
              mark.style.fontSize = `${slice.height * 0.42}px`;
              wrap.append(mark);
            } else {
              wrap.append(slice.canvas);
            }
            host.append(wrap);
          });
        }
      }

      const frags = fragRef.current;
      if (frags) {
        frags.replaceChildren();
        for (const frag of frame.frags) {
          const node = document.createElement("p");
          node.className = "crt-transit__frag";
          node.dataset.anchor = frag.anchor;
          node.style.left = `${frag.x}vw`;
          node.style.top = `${frag.y}vh`;
          node.style.fontSize = `${frag.size}px`;
          node.style.opacity = String(frag.opacity);
          for (const glyph of frag.glyphs) {
            const mark = document.createElement("span");
            mark.className = "crt-transit__ch";
            mark.dataset.face = glyph.face;
            mark.style.transform = `translateY(${glyph.dy}em)`;
            mark.style.marginRight = `${glyph.track}em`;
            mark.append(rasterRecallGlyph(glyph));
            node.append(mark);
          }
          if (frag.caret && Math.floor(now / 360) % 2 === 0) {
            const caret = document.createElement("span");
            caret.className = "crt-transit__caret";
            caret.setAttribute("aria-hidden", "true");
            node.append(caret);
          }
          frags.append(node);
        }
      }

      if (frame.done) {
        finished = true;
        applyGrade(exitRef.current, "", false);
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
      applyGrade(exitRef.current, "", false);
      publishTransitShare({
        timeScale: 1,
        interact: true,
        hideText: false,
        scanBoost: 0,
      });
    };
  }, [exitRef]);

  return (
    <div className={`crt-transit ${recallCond.variable} ${recallOsw.variable}`}>
      <div ref={hostRef} className="crt-transit__glyphs" />
      <div ref={fragRef} />
    </div>
  );
}
