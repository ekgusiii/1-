"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import {
  ARCHIVE,
  archiveLocalT,
  archivePhaseAt,
  mulberry32,
  randRange,
  type ArchivePhase,
} from "@/components/archive/archiveConfig";
import {
  makeGlitchBands,
  SignalField,
  type SignalGlitch,
} from "@/components/archive/SignalField";
import {ArchiveCrtFx} from "@/components/archive/ArchiveCrtFx";
import {SkyField} from "@/components/archive/SkyField";
import {CRTBase} from "@/components/CRTBase";
import {recallRush, type RecallPhase} from "@/components/archive/archiveRecall";

import "./archive.css";

export const ArchiveRecallContext = createContext<(phase: RecallPhase) => void>(() => {});

type Flash = {
  id: number;
  y: number;
  color: string;
  width: number;
  life: number;
};

type ArchiveSequenceProps = {
  fxRootRef: RefObject<HTMLDivElement | null>;
  onPhaseChange: (phase: ArchivePhase) => void;
  onRecallStart?: () => void;
  onRecallDone?: () => void;
  preset?: ArchivePhase;
  children?: ReactNode;
};

function applyMoireCollapse(el: HTMLElement | null, u: number) {
  if (!el) {
    return;
  }
  const start = ARCHIVE.squeezeStart;
  if (u < start) {
    const t = u / start;
    const e = t * t;
    el.style.opacity = String(1 - e);
    el.style.filter = `contrast(${(1 - 0.88 * e).toFixed(3)}) saturate(${(1 - 0.75 * e).toFixed(3)})`;
    el.style.transform = `scaleX(${(1 + 0.7 * e).toFixed(3)})`;
    el.style.transformOrigin = "50% 50%";
    return;
  }
  const t = (u - start) / (1 - start);
  el.style.opacity = String(Math.max(0, 1 - t * 1.2));
  el.style.filter = "contrast(0.08) brightness(1.8)";
  el.style.transform = `scaleX(1.7) scaleY(${Math.max(0.02, 1 - t * 0.98).toFixed(3)})`;
  el.style.transformOrigin = "50% 50%";
}

function clearMoireCollapse(el: HTMLElement | null) {
  if (!el) {
    return;
  }
  el.style.opacity = "";
  el.style.filter = "";
  el.style.transform = "";
  el.style.transformOrigin = "";
}

export function ArchiveSequence({
  fxRootRef,
  onPhaseChange,
  onRecallStart,
  onRecallDone,
  preset,
  children,
}: ArchiveSequenceProps) {
  const [phase, setPhase] = useState<ArchivePhase>(preset ?? "moire");
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [shake, setShake] = useState({x: 0, y: 0});
  const [kill, setKill] = useState(0);
  const [noise, setNoise] = useState(0.03);
  const [signalOn, setSignalOn] = useState(false);
  const [signalIntensity, setSignalIntensity] = useState(0);
  const [glitch, setGlitch] = useState<SignalGlitch | null>(null);
  const [barrel, setBarrel] = useState(false);
  const [skyOn, setSkyOn] = useState(false);
  const [skyLock, setSkyLock] = useState(0);
  const [recall, setRecall] = useState<RecallPhase>("idle");
  const recallDoneRef = useRef(false);
  const onRecallStartRef = useRef(onRecallStart);
  const onRecallDoneRef = useRef(onRecallDone);
  onRecallStartRef.current = onRecallStart;
  onRecallDoneRef.current = onRecallDone;
  const publishRecall = useCallback((next: RecallPhase) => {
    setRecall(next);
    if (next === "reveal") {
      onRecallStartRef.current?.();
    }
  }, []);
  const finishRecall = () => {
    if (recallDoneRef.current) {
      return;
    }
    recallDoneRef.current = true;
    onRecallDoneRef.current?.();
  };
  const phaseRef = useRef<ArchivePhase>("moire");
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  useEffect(() => {
    document.body.dataset.crt = "archive";
    document.body.classList.add("is-archive");
    return () => {
      delete document.body.dataset.crt;
      document.body.classList.remove("is-archive");
    };
  }, []);

  useEffect(() => {
    if (preset === "signal") {
      setPhase("signal");
      setSignalOn(false);
      setSignalIntensity(0);
      setBarrel(false);
      setNoise(0);
      setSkyOn(true);
      setSkyLock(1);
      onPhaseChangeRef.current("signal");
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const rng = mulberry32((start & 0xffff) ^ 0x0a2c);
    let raf = 0;
    let flashId = 0;
    let nextFlash = ARCHIVE.hushQuietMs + randRange(rng, 80, 180);
    let nextShake = 0;
    let nextShuffle = 0;
    let bands: SignalGlitch["bands"] = [];
    let rolled = false;
    let dropped = false;

    const tick = (now: number) => {
      const ms = now - start;
      const next = archivePhaseAt(ms, reduced);
      const local = archiveLocalT(ms, next, reduced);

      if (next !== phaseRef.current) {
        phaseRef.current = next;
        setPhase(next);
        onPhaseChangeRef.current(next);
      }

      if (next === "moire") {
        applyMoireCollapse(fxRootRef.current, Math.min(1, local));
        setKill(local >= ARCHIVE.squeezeStart ? Math.min(1, (local - ARCHIVE.squeezeStart) / 0.08) : 0);
        setSignalOn(false);
      } else {
        clearMoireCollapse(fxRootRef.current);
        setKill(0);
      }

      if (next === "hush") {
        const hushMs = local * ARCHIVE.hushMs;
        if (hushMs < ARCHIVE.hushQuietMs) {
          setNoise(0.025);
          setFlashes([]);
          setShake({x: 0, y: 0});
        } else {
          const rise = (hushMs - ARCHIVE.hushQuietMs) / (ARCHIVE.hushMs - ARCHIVE.hushQuietMs);
          setNoise(0.03 + rise * 0.09);
          if (hushMs >= nextFlash) {
            const gap = randRange(rng, 140 - rise * 90, 240 - rise * 150);
            nextFlash = hushMs + Math.max(28, gap);
            const spawned: Flash[] = [
              {
                id: (flashId += 1),
                y: 46 + randRange(rng, -10, 10),
                color: rng() < 0.5 ? "#2fd6b0" : "#e046b0",
                width: randRange(rng, 18, 54),
                life: 1,
              },
            ];
            if (rng() < 0.35 + rise * 0.4) {
              spawned.push({
                id: (flashId += 1),
                y: 50 + randRange(rng, -16, 16),
                color: rng() < 0.5 ? "#2fd6b0" : "#c83c9c",
                width: randRange(rng, 12, 40),
                life: 1,
              });
            }
            setFlashes(spawned);
          } else {
            setFlashes((prev) =>
              prev
                .map((item) => ({...item, life: item.life - 0.16}))
                .filter((item) => item.life > 0),
            );
          }
          if (hushMs >= nextShake) {
            nextShake = hushMs + randRange(rng, 70, 160);
            if (rng() < 0.45 + rise * 0.35) {
              setShake({
                x: randRange(rng, -1, 1),
                y: randRange(rng, -1, 1),
              });
            } else {
              setShake({x: 0, y: 0});
            }
          }
        }
        setSignalOn(false);
        setSignalIntensity(0);
        setGlitch(null);
        setBarrel(false);
      }

      if (next === "glitch") {
        setFlashes([]);
        setSignalOn(true);
        setBarrel(false);
        setNoise(0.12);
        if (reduced) {
          setSignalIntensity(Math.min(1, local));
          setGlitch(null);
          setShake({x: 0, y: 0});
        } else {
          setSignalIntensity(0.35 + local * 0.45);
          const h = window.visualViewport?.height ?? window.innerHeight;
          if (now >= nextShuffle) {
            nextShuffle = now + randRange(rng, ARCHIVE.reshuffleMinMs, ARCHIVE.reshuffleMaxMs);
            bands = makeGlitchBands(rng, h);
          }
          const rgb = randRange(rng, ARCHIVE.rgbMin, ARCHIVE.rgbMax);
          const rolling = !rolled && local >= ARCHIVE.rollAt && local < ARCHIVE.rollAt + 0.12;
          if (local >= ARCHIVE.rollAt) {
            rolled = true;
          }
          const dropping = !dropped && local >= ARCHIVE.dropAt && local < ARCHIVE.dropAt + ARCHIVE.dropMs / ARCHIVE.glitchMs;
          if (local >= ARCHIVE.dropAt) {
            dropped = true;
          }
          setGlitch({
            bands,
            rgb,
            roll: rolling ? -ARCHIVE.rollPx : 0,
            brightness: dropping ? 0.22 : 1,
          });
          setShake({
            x: rolling ? randRange(rng, -1, 1) : 0,
            y: rolling ? -2 : 0,
          });
        }
      }

      if (next === "sky") {
        clearMoireCollapse(fxRootRef.current);
        setSignalOn(false);
        setSignalIntensity(0);
        setGlitch(null);
        setBarrel(false);
        setSkyOn(true);
        setSkyLock(Math.min(1, local));
        setNoise(0.42 * (1 - local * local));
        setShake({x: 0, y: 0});
        setFlashes([]);
      }

      if (next === "signal") {
        clearMoireCollapse(fxRootRef.current);
        setSignalOn(false);
        setSignalIntensity(0);
        setGlitch(null);
        setBarrel(false);
        setSkyOn(true);
        setSkyLock(1);
        setNoise(0);
        setShake({x: 0, y: 0});
        setFlashes([]);
      }

      raf = window.requestAnimationFrame(tick);
    };

    onPhaseChangeRef.current("moire");
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      clearMoireCollapse(fxRootRef.current);
    };
  }, [fxRootRef]);

  useEffect(() => {
    if (recall !== "reveal") {
      return;
    }
    const id = window.setTimeout(() => {
      if (recallDoneRef.current) {
        return;
      }
      recallDoneRef.current = true;
      onRecallDoneRef.current?.();
    }, 1100);
    return () => window.clearTimeout(id);
  }, [recall]);

  const remnant = phase !== "moire";

  return (
    <div
      className="arc-root"
      data-archive-phase={phase}
      data-recall={recall}
      onAnimationEnd={(event) => {
        if (event.animationName === "arc-recall-welcome") {
          finishRecall();
        }
      }}
    >
      <svg className="epg__svgdefs" aria-hidden width="0" height="0">
        <filter
          id="arc-barrel"
          x="-14%"
          y="-18%"
          width="128%"
          height="136%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            id="arc-disp"
            result="map"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          />
          <feDisplacementMap
            id="arc-disp-map"
            in="SourceGraphic"
            in2="map"
            scale="72"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {phase === "moire" ? (
        <div className="arc-kill" style={{opacity: kill}} />
      ) : null}

      {phase !== "moire" ? (
        <div
          className="arc-stage"
          style={{transform: `translate3d(${shake.x}px, ${shake.y}px, 0)`}}
        >
          {skyOn ? <SkyField lock={skyLock} rush={recallRush(recall)} /> : null}

          {ARCHIVE.signalCanvas && signalOn ? (
            <div className="arc-signal-host">
              <div className={barrel ? "arc-signal-low arc-barrel" : "arc-signal-low"}>
                <SignalField intensity={signalIntensity} glitch={glitch} />
              </div>
            </div>
          ) : null}

          {phase === "glitch" && signalOn ? (
            <div className="arc-signal-host">
              <div className="arc-signal-low">
                <SignalField intensity={signalIntensity} glitch={glitch} />
              </div>
            </div>
          ) : null}

          {flashes.map((flash) => (
            <div
              key={flash.id}
              className="arc-flash"
              style={{
                top: `${flash.y}%`,
                width: `${flash.width}%`,
                background: flash.color,
                opacity: Math.max(0, flash.life),
                boxShadow: `0 0 6px ${flash.color}`,
              }}
            />
          ))}

          {phase !== "signal" && phase !== "sky" ? <div className="arc-scan" /> : null}
          {phase !== "signal" && noise > 0 ? (
            <div className="arc-noise" style={{opacity: noise}} />
          ) : null}
          <div
            className={
              phase === "signal" || phase === "sky"
                ? "arc-vignette arc-vignette--sky"
                : "arc-vignette"
            }
          />
        </div>
      ) : null}

      <ArchiveRecallContext.Provider value={publishRecall}>
        {children}
      </ArchiveRecallContext.Provider>

      {phase === "signal" || phase === "sky" ? <ArchiveCrtFx /> : null}

      {remnant && phase !== "signal" && phase !== "sky" ? (
        <div className="arc-crt">
          <CRTBase />
        </div>
      ) : null}

      <BarrelMap />
    </div>
  );
}

function BarrelMap() {
  useEffect(() => {
    const image = document.getElementById("arc-disp");
    const map = document.getElementById("arc-disp-map");
    if (!image || !map) {
      return;
    }
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const pixels = ctx.createImageData(size, size);
    const data = pixels.data;
    const k = ARCHIVE.barrelK;
    const apply = () => {
      const height =
        (window.visualViewport?.height ?? window.innerHeight) *
        ARCHIVE.signalBuffer;
      const scale = Math.max(24, height * 0.14);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const xn = x / (size - 1);
          const yn = y / (size - 1);
          const nx = (xn - 0.5) / 0.5;
          const yFlat = 0.5 + (yn - 0.5) / (1 + k * nx * nx);
          const offsetN = yFlat - yn;
          const i = (y * size + x) * 4;
          data[i] = 128;
          data[i + 1] = Math.max(0, Math.min(255, 128 + (offsetN / 0.14) * 127));
          data[i + 2] = 128;
          data[i + 3] = 255;
        }
      }
      ctx.putImageData(pixels, 0, 0);
      const href = canvas.toDataURL("image/png");
      image.setAttribute("href", href);
      image.setAttribute("xlink:href", href);
      map.setAttribute("scale", scale.toFixed(1));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return null;
}
