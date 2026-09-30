"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clamp01,
  computeAlignmentField,
  layoutHotspotPositions,
  lerpToward,
  type Hotspot,
} from "@/components/crt/crtAlignment";
import {ArchiveDesktop} from "@/components/archive/ArchiveDesktop";
import {ArchiveSequence} from "@/components/archive/ArchiveSequence";
import type {ArchivePhase} from "@/components/archive/archiveConfig";
import {
  INITIAL_ENTER,
  enterVisuals,
  inEnterZone,
  tickEnter,
} from "@/components/crt/crtEnter";
import {
  INITIAL_INTERFERENCE,
  tickInterference,
} from "@/components/crt/crtInterference";
import { createCrtMoireGl, type CrtMoireGl } from "@/components/crt/crtMoireGl";
import {
  getGuidePrograms,
  type GuideProgram,
  projectsWithPreviewMedia,
} from "@/components/crt/projectPreview";
import {
  createGuideRefract,
  type GuideRefract,
} from "@/components/crt/guideRefract";
import {CrtTransit, recallFaceClass} from "@/components/crt/CrtTransit";
import { MainFx } from "@/components/MainFx";
import { readMoireShare, publishTransitShare } from "@/lib/moireShare";
import { frequencyForPage } from "@/lib/sound/pageFrequencies";
import { usePageTransitionSound } from "@/lib/sound/usePageTransitionSound";
import { publishEnter } from "@/lib/sound/soundBus";
import type { Project } from "@/sanity/lib/queries";

type CrtMode = "explore" | "guide" | "playback" | "archive";

type CrtScreenProps = {
  projects: Project[];
  routeSlug?: string | null;
};

export function CrtScreen({ projects, routeSlug = null }: CrtScreenProps) {
  const router = useRouter();
  const glassRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<CrtMoireGl | null>(null);
  const refractRef = useRef<GuideRefract | null>(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const pointerRef = useRef<{x: number; y: number} | null>(null);
  const currentRef = useRef({preview: 0, misalign: 1});
  const interferenceRef = useRef({...INITIAL_INTERFERENCE});
  const enterRef = useRef({...INITIAL_ENTER});
  const enterPhaseRef = useRef(INITIAL_ENTER.phase);
  const lastVisRef = useRef(enterVisuals(0, 0));
  const archiveOnRef = useRef(Boolean(routeSlug));
  const transitOnRef = useRef(false);
  const simTimeRef = useRef(0);
  const exitRef = useRef<HTMLDivElement>(null);
  const fxRootRef = useRef<HTMLDivElement>(null);
  const nearestIdRef = useRef<string | null>(null);
  const projectsRef = useRef(projects);
  const playTransitionSound = usePageTransitionSound();
  const playTransitionRef = useRef(playTransitionSound);
  const hotspotsRef = useRef<Hotspot[]>([]);
  const startLoopRef = useRef<() => void>(() => {});
  const modeRef = useRef<CrtMode>(routeSlug ? "archive" : "explore");
  const hasProgramsRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<CrtMode>(routeSlug ? "archive" : "explore");
  const [playing, setPlaying] = useState<GuideProgram | null>(null);
  const [archiveOn, setArchiveOn] = useState(Boolean(routeSlug));
  const [transitOn, setTransitOn] = useState(false);
  const freezePlateRef = useRef<HTMLCanvasElement | null>(null);
  const [freezePlate, setFreezePlate] = useState<HTMLCanvasElement | null>(null);
  const [freezeBounds, setFreezeBounds] = useState<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);
  const [archivePhase, setArchivePhase] = useState<ArchivePhase | null>(
    routeSlug ? "signal" : null,
  );

  const mediaProjects = useMemo(
    () => projectsWithPreviewMedia(projects),
    [projects],
  );
  const programs = useMemo(() => getGuidePrograms(projects), [projects]);
  const programsRef = useRef(programs);

  const hotspots = useMemo(() => {
    const positions = layoutHotspotPositions(mediaProjects.length);
    return mediaProjects.map((project, index) => ({
      id: project._id,
      x: positions[index]?.x ?? 0.5,
      y: positions[index]?.y ?? 0.5,
    }));
  }, [mediaProjects]);

  projectsRef.current = projects;
  playTransitionRef.current = playTransitionSound;
  hotspotsRef.current = hotspots;
  modeRef.current = mode;
  hasProgramsRef.current = mediaProjects.length > 0;
  programsRef.current = programs;

  useEffect(() => {
    if (!activeId && hotspots[0]) {
      setActiveId(hotspots[0].id);
    }
  }, [activeId, hotspots]);

  useEffect(() => {
    if (mode !== "explore") {
      return;
    }

    const canvas = canvasRef.current;
    const glass = glassRef.current;
    if (!canvas || !glass) {
      return;
    }

    const renderer = createCrtMoireGl(canvas);
    glRef.current = renderer;
    if (!renderer) {
      return;
    }
    renderer.setGuide(programs);
    const refract = createGuideRefract();
    refractRef.current = refract;

    const viewportSize = () => {
      const view = window.visualViewport;
      return {
        width: view?.width ?? window.innerWidth,
        height: view?.height ?? window.innerHeight,
      };
    };

    const resize = () => {
      const size = viewportSize();
      renderer.resize(size.width, size.height);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(glass);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    let dprQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    const onDprChange = () => {
      dprQuery.removeEventListener("change", onDprChange);
      dprQuery = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      dprQuery.addEventListener("change", onDprChange);
      resize();
    };
    dprQuery.addEventListener("change", onDprChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      dprQuery.removeEventListener("change", onDprChange);
      renderer.destroy();
      glRef.current = null;
      refract?.destroy();
      refractRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    glRef.current?.setGuide(programs);
  }, [programs, mode]);

  useEffect(() => {
    const apply = (
      previewValue: number,
      misalign: number,
      extras: Record<string, string>,
    ) => {
      const node = glassRef.current;
      if (!node) {
        return;
      }

      node.style.setProperty("--misalign", misalign.toFixed(4));
      node.style.setProperty("--align", (1 - misalign).toFixed(4));
      node.style.setProperty("--reveal", previewValue.toFixed(4));

      for (const [name, value] of Object.entries(extras)) {
        node.style.setProperty(name, value);
      }
    };

    const tick = (now: number) => {
      const previous = lastTimeRef.current || now;
      const rawDt = Math.min(0.05, (now - previous) / 1000);
      lastTimeRef.current = now;
      const dt = rawDt * (transitOnRef.current ? readMoireShare().timeScale : 1);
      simTimeRef.current += dt;

      const node = glassRef.current;
      const pointer = pointerRef.current;
      const locked = modeRef.current !== "explore";
      let targetPreview = locked ? 1 : 0;
      let targetMisalign = locked ? 0 : 1;
      let nearestId: string | null = nearestIdRef.current;
      const rect = node?.getBoundingClientRect();

      if (!locked && node && pointer && rect) {
        const field = computeAlignmentField(
          pointer.x,
          pointer.y,
          rect.width,
          rect.height,
          hotspotsRef.current,
        );
        targetPreview = field.preview;
        targetMisalign = field.misalign;
        nearestId = field.nearestId;
      }

      const current = currentRef.current;
      current.preview = lerpToward(current.preview, targetPreview, dt);
      current.misalign = lerpToward(current.misalign, targetMisalign, dt);

      const extras = tickInterference(
        interferenceRef.current,
        dt,
        pointer,
        rect?.width ?? 0,
        rect?.height ?? 0,
        current.misalign,
        simTimeRef.current * 1000,
        locked,
        glRef.current?.getTextBounds(),
      );
      apply(current.preview, current.misalign, extras.css);

      let vis = lastVisRef.current;
      if (!archiveOnRef.current) {
        const inZone =
          !locked &&
          !!pointer &&
          !!rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          inEnterZone(pointer.x / rect.width, pointer.y / rect.height);

        const entered = tickEnter(
          enterRef.current,
          dt,
          inZone,
          hasProgramsRef.current && !locked,
        );
        vis = entered.visuals;
        lastVisRef.current = vis;
        const prevPhase = enterPhaseRef.current;
        const nextPhase = enterRef.current.phase;
        if (prevPhase !== nextPhase) {
          if (nextPhase === "dwell") {
            publishEnter("hold");
          } else if (
            nextPhase === "idle" &&
            (prevPhase === "dwell" || prevPhase === "inhale")
          ) {
            publishEnter("cancel");
          }
        }
        enterPhaseRef.current = nextPhase;

        if (
          prevPhase === "dwell" &&
          nextPhase === "transit" &&
          modeRef.current === "explore" &&
          hasProgramsRef.current
        ) {
          publishTransitShare({
            timeScale: 0,
            interact: false,
            scanBoost: 0,
            hideText: false,
          });
          freezePlateRef.current = null;
          setFreezePlate(null);
          setFreezeBounds(null);
          transitOnRef.current = true;
          setTransitOn(true);
          const list = projectsRef.current;
          const nearest = nearestIdRef.current;
          const found = list.findIndex((project) => project._id === nearest);
          const index = found >= 0 ? found : 0;
          playTransitionRef.current(
            frequencyForPage(list[index]?.slug, index),
          );
        }
      }

      const holeLock = locked ? 1 : vis.holeLock;
      const holeAmount = locked
        ? 0
        : clamp01(Math.max(vis.holeHold, extras.glow));

      glRef.current?.render({
        mouseX: extras.mouseX,
        mouseY: extras.mouseY,
        glow: extras.glow,
        misalign: current.misalign,
        time: simTimeRef.current,
        fov: extras.fov,
        textOpacity: locked || readMoireShare().hideText ? 0 : 1,
        textPeakX: extras.textPeakX,
        textPeakY: extras.textPeakY,
        textBulge: extras.textBulge,
        textInk: extras.textInk,
        textInside: extras.textInside,
        holeCenterX: holeLock > 0.5 ? 0.5 : extras.holeX,
        holeCenterY: holeLock > 0.5 ? 0.5 : 1 - extras.holeY,
        holeAmount,
        holeExpand: locked ? 1 : vis.holeExpand,
        enterScatter: locked ? 1 : vis.scatter,
        enterDim: locked ? 0 : vis.dim,
        enterFlash: locked ? 0 : vis.flash,
        enterScan: locked ? 0 : vis.scan,
        enterBlur: locked ? 0 : vis.blur,
        enterCA: locked ? 0 : vis.ca,
        noiseSlow: locked ? 0 : vis.noiseSlow,
        guideAmount: locked ? 0 : extras.guideAmount,
        wash: locked ? 0 : extras.wash,
        bandShiftX: locked ? 0 : extras.bandShiftX,
        bandShiftY: locked ? 0 : extras.bandShiftY,
      });

      if (
        transitOnRef.current &&
        !freezePlateRef.current &&
        canvasRef.current &&
        canvasRef.current.width > 0
      ) {
        const src = canvasRef.current;
        const dst = document.createElement("canvas");
        dst.width = src.width;
        dst.height = src.height;
        dst.getContext("2d")?.drawImage(src, 0, 0);
        freezePlateRef.current = dst;
        setFreezePlate(dst);
        setFreezeBounds(glRef.current?.getTextBounds() ?? null);
      }

      if (node) {
        node.style.setProperty(
          "--guide-scale",
          (locked ? 1 : vis.guideScale).toFixed(4),
        );
        node.style.setProperty(
          "--canvas-scale",
          (locked ? 1 : vis.canvasScale).toFixed(4),
        );
        const holeX = holeLock > 0.5 ? 0.5 : extras.holeX;
        const holeY = holeLock > 0.5 ? 0.5 : extras.holeY;
        node.style.setProperty("--hole-x", `${(holeX * 100).toFixed(2)}%`);
        node.style.setProperty("--hole-y", `${(holeY * 100).toFixed(2)}%`);
        node.style.setProperty(
          "--guide-lens",
          (locked ? 1 : 1 + 0.04 * holeAmount).toFixed(4),
        );
        if (!locked) {
          refractRef.current?.update(holeX, holeY, holeAmount);
        }
      }

      if (nearestId && nearestId !== nearestIdRef.current) {
        nearestIdRef.current = nearestId;
        setActiveId(nearestId);
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (frameRef.current) {
        return;
      }

      lastTimeRef.current = 0;
      frameRef.current = window.requestAnimationFrame(tick);
    };

    startLoopRef.current = start;
    start();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mode === "playback") {
        setPlaying(null);
        setMode("guide");
        startLoopRef.current();
      }
    };

    const onPopState = () => {
      if (archiveOnRef.current) {
        return;
      }
      enterRef.current = {...INITIAL_ENTER};
      enterPhaseRef.current = INITIAL_ENTER.phase;
      lastVisRef.current = enterVisuals(0, 0);
      pointerRef.current = null;
      setPlaying(null);
      setMode("explore");
      startLoopRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, [mode]);

  const updatePointer = (clientX: number, clientY: number) => {
    if (archiveOnRef.current || transitOnRef.current) {
      return;
    }
    const node = glassRef.current;
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    pointerRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    startLoopRef.current();
  };

  const openProgram = (program: GuideProgram) => {
    setPlaying(program);
    setMode("playback");
    startLoopRef.current();
  };

  const returnToGuide = () => {
    setPlaying(null);
    setMode("guide");
    startLoopRef.current();
  };

  const showExploreFx =
    mode === "explore" &&
    (archivePhase === null || archivePhase === "moire");

  const handleArchivePhase = (next: ArchivePhase) => {
    setArchivePhase(next);
    if (next !== "moire" && modeRef.current === "explore") {
      modeRef.current = "archive";
      setMode("archive");
    }
  };

  const prepareWelcome = () => {
    enterRef.current = {...INITIAL_ENTER};
    enterPhaseRef.current = INITIAL_ENTER.phase;
    lastVisRef.current = enterVisuals(0, 0);
    currentRef.current = {preview: 0, misalign: 1};
    pointerRef.current = null;
    modeRef.current = "explore";
    setMode("explore");
    setArchivePhase(null);
    startLoopRef.current();
  };

  const finishRecall = () => {
    archiveOnRef.current = false;
    setArchiveOn(false);
    if (window.location.pathname.startsWith("/work/")) {
      router.replace("/");
      return;
    }
    if (window.history.state?.crtView === "archive") {
      window.history.replaceState({crtView: "welcome"}, "", window.location.href);
    }
  };

  const finishTransit = () => {
    transitOnRef.current = false;
    setTransitOn(false);
    archiveOnRef.current = true;
    setArchiveOn(true);
    setArchivePhase("signal");
    modeRef.current = "archive";
    setMode("archive");
    if (window.history.state?.crtView !== "archive") {
      window.history.pushState({crtView: "archive"}, "", window.location.href);
    }
  };

  return (
    <main className={`stage ${recallFaceClass}`} data-archive-phase={archivePhase ?? "off"}>
      <div ref={exitRef} className="crt-main-exit">
      <div
        ref={fxRootRef}
        className="archive-fx-root"
        style={{position: "fixed", inset: 0, width: "100vw", height: "100dvh"}}
      >
        <div
          ref={glassRef}
          className={
            programs.length > 0
              ? "crt crt__glass crt__glass--has-guide"
              : "crt crt__glass"
          }
          data-project-count={projects.length}
          data-mode={mode}
          onPointerEnter={(event) => {
            updatePointer(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            updatePointer(event.clientX, event.clientY);
          }}
        >
          <div className="crt__content">
            {mode === "playback" && playing ? (
              <div className="crt__media crt__media--playback">
                <video
                  key={playing.id}
                  src={playing.url}
                  autoPlay
                  playsInline
                  aria-label={playing.title}
                  onEnded={returnToGuide}
                />
                <button
                  type="button"
                  className="crt__back"
                  onClick={returnToGuide}
                >
                  BACK
                </button>
              </div>
            ) : null}

            <h1 className="crt__welcome">WELCOME</h1>
          </div>

          {showExploreFx ? (
            <canvas ref={canvasRef} className="crt__gl" aria-hidden="true" />
          ) : null}
        </div>
        {showExploreFx ? <MainFx /> : null}
      </div>
      {transitOn ? (
        <CrtTransit
          plate={freezePlate}
          bounds={freezeBounds}
          projects={projects}
          exitRef={exitRef}
          onDone={finishTransit}
        />
      ) : null}
      </div>
      {archiveOn ? (
        <ArchiveSequence
          fxRootRef={fxRootRef}
          onPhaseChange={handleArchivePhase}
          onRecallStart={prepareWelcome}
          onRecallDone={finishRecall}
          preset="signal"
        >
          {archivePhase === "signal" ? (
            <ArchiveDesktop projects={projects} openSlug={routeSlug} />
          ) : null}
        </ArchiveSequence>
      ) : null}
    </main>
  );
}
