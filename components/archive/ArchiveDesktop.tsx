"use client";

import {useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent} from "react";
import {createPortal} from "react-dom";
import {useRouter} from "next/navigation";

import {ARCHIVE} from "@/components/archive/archiveConfig";
import {slideBlurAt} from "@/components/archive/archiveSpring";
import {buildArchiveItems, type ArchiveItem} from "@/components/archive/archiveItems";
import {buildSpawnPlan} from "@/components/archive/archiveSpawn";
import {
  approachLook,
  autoLayEaseT,
  idleLook,
  mixLooks,
  nodeCenter,
  paintTune,
  playTuneLock,
  rankFromOrigin,
  tuneActiveLook,
  tuneBgLook,
  type TuneRank,
} from "@/components/archive/archiveTune";
import {
  claimArchiveVideo,
  cueArchiveVideo,
  driveVideos,
  holdArchiveVideo,
  releaseArchiveAudio,
  releaseArchiveVideo,
  setArchiveHearMuted,
  type VideoBind,
} from "@/components/archive/archiveVideos";
import {SoundEngine} from "@/lib/sound/SoundEngine";
import {decidePanelSide, InfoPanel, type InfoSide} from "@/components/archive/InfoPanel";
import {ArchiveRecallContext} from "@/components/archive/ArchiveSequence";
import {
  flightFor,
  pushSample,
  readShake,
  type Flight,
  type RecallPhase,
} from "@/components/archive/archiveRecall";
import {frequencyForPage} from "@/lib/sound/pageFrequencies";
import {usePageTransitionSound} from "@/lib/sound/usePageTransitionSound";
import type {Project} from "@/sanity/lib/queries";

type Rect = {x: number; y: number; w: number; h: number};
type LockStep = 0 | 1 | 2 | 3;

type Motion = {
  slug: string;
  dir: "in" | "out";
  from: Rect;
  to: Rect;
  step: 0 | 1 | 2 | 3;
  glitch: boolean;
};

const STEPS = [0, 0.38, 0.78, 1] as const;
const STEP_MS = [0, 60, 120, 180] as const;
const MARGIN = 0.05;

function mixRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

function fullRect(): Rect {
  const vw = window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  return {
    x: vw * MARGIN,
    y: vh * MARGIN,
    w: vw * (1 - MARGIN * 2),
    h: vh * (1 - MARGIN * 2),
  };
}

type StandPlan = {
  id: string;
  scale: number;
  dx: number;
  dy: number;
  side: InfoSide;
  box: Rect;
};

function viewSize() {
  return {
    vw: window.innerWidth,
    vh: window.visualViewport?.height ?? window.innerHeight,
  };
}

function stoodBox(rect: Rect): Rect {
  const scale = ARCHIVE.standScale;
  return {
    x: rect.x + rect.w * 0.5 - (rect.w * scale) * 0.5,
    y: rect.y + rect.h * 0.5 - (rect.h * scale) * 0.5,
    w: rect.w * scale,
    h: rect.h * scale,
  };
}

function planStandLayout(id: string, rect: Rect): StandPlan {
  const {vw, vh} = viewSize();
  const pad = ARCHIVE.standPad;
  const availW = Math.max(1, vw - pad * 2);
  const availH = Math.max(1, vh - pad * 2);
  const maxWinW = Math.max(1, availW - ARCHIVE.infoWidth);
  const scale = Math.min(ARCHIVE.standScale, maxWinW / rect.w, availH / rect.h);
  const win: Rect = {
    w: rect.w * scale,
    h: rect.h * scale,
    x: rect.x + rect.w * 0.5 - (rect.w * scale) * 0.5,
    y: rect.y + rect.h * 0.5 - (rect.h * scale) * 0.5,
  };
  const side = decidePanelSide(win.x);
  const unionX = side === "left" ? win.x - ARCHIVE.infoWidth : win.x;
  const unionW = win.w + ARCHIVE.infoWidth;
  let dx = 0;
  let dy = 0;
  if (unionX + dx < pad) {
    dx += pad - (unionX + dx);
  }
  if (unionX + unionW + dx > vw - pad) {
    dx += vw - pad - (unionX + unionW + dx);
  }
  if (win.y + dy < pad) {
    dy += pad - (win.y + dy);
  }
  if (win.y + win.h + dy > vh - pad) {
    dy += vh - pad - (win.y + win.h + dy);
  }
  return {
    id,
    scale,
    dx,
    dy,
    side,
    box: {x: win.x + dx, y: win.y + dy, w: win.w, h: win.h},
  };
}

function itemRect(item: ArchiveItem): Rect {
  const vw = window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  return {
    x: (item.x / 100) * vw,
    y: (item.y / 100) * vh,
    w: item.w,
    h: item.h,
  };
}

function padClip(value: number) {
  return String(value).padStart(2, "0");
}

function label(item: ArchiveItem) {
  const title = (item.title ?? "").toUpperCase();
  if (item.clickable && item.clipIndex) {
    return `${title} — ${padClip(item.clipIndex)}`;
  }
  return title.endsWith(".MOV") ? title : `${title}.MOV`;
}

function poseTransform(
  item: ArchiveItem,
  scale: number,
  stood: boolean,
  detail: boolean,
  plan: StandPlan | null,
) {
  if (detail) {
    return "none";
  }
  if (stood) {
    const standScale = plan?.scale ?? ARCHIVE.standScale;
    const dx = plan?.dx ?? 0;
    const dy = plan?.dy ?? 0;
    return `rotateX(0deg) rotateZ(0deg) translate(${dx}px, ${dy}px) scale(${standScale})`;
  }
  return `rotateX(${item.tiltX}deg) rotateZ(${item.tiltZ}deg) translateZ(var(--arc-tune-z, 0px)) scale(calc(${scale} * var(--arc-tune-scale, 1))) translateY(var(--arc-slide-y, 0px))`;
}

type TuneEngine = {
  activeId: string | null;
  approachId: string | null;
  ranks: TuneRank[];
  timers: number[];
};

function visibleItems(
  items: ArchiveItem[],
  lockMap: Record<string, LockStep>,
) {
  return items.filter((item) => (lockMap[item.id] ?? 0) >= 3);
}

function applyTune(
  pointer: {x: number; y: number},
  live: boolean,
  items: ArchiveItem[],
  lockMap: Record<string, LockStep>,
  nodes: Map<string, HTMLElement>,
  hoverId: string | null,
  stoodId: string | null,
  engine: TuneEngine,
  returningId: string | null,
  returnT: number,
) {
  const visible = visibleItems(items, lockMap);
  if (returningId) {
    const t = autoLayEaseT(returnT);
    const from = items.find((item) => item.id === returningId);
    if (from) {
      paintTune(nodes.get(returningId), mixLooks(tuneActiveLook(), idleLook(from), t));
    }
    engine.ranks.forEach((row) => {
      const item = items.find((entry) => entry.id === row.id);
      if (item) {
        paintTune(nodes.get(row.id), mixLooks(tuneBgLook(row.band), idleLook(item), t));
      }
    });
    if (t >= 1) {
      engine.activeId = null;
      engine.ranks = [];
    }
    return;
  }
  if (!live) {
    engine.timers.forEach((id) => window.clearTimeout(id));
    engine.timers = [];
    engine.activeId = null;
    engine.approachId = null;
    engine.ranks = [];
    return;
  }

  const activeId = stoodId ?? hoverId;
  if (activeId !== engine.activeId) {
    engine.timers.forEach((id) => window.clearTimeout(id));
    engine.timers = [];
    const prev = engine.activeId;
    engine.activeId = activeId;
    engine.approachId = null;
    if (activeId) {
      const originItem = items.find((item) => item.id === activeId);
      const origin = nodeCenter(
        activeId,
        nodes,
        originItem ? itemRect(originItem) : {x: pointer.x, y: pointer.y, w: 0, h: 0},
      );
      engine.ranks = rankFromOrigin(activeId, visible, origin, nodes);
      playTuneLock(nodes.get(activeId));
      paintTune(nodes.get(activeId), tuneActiveLook());
      engine.ranks.forEach((row, index) => {
        const timer = window.setTimeout(() => {
          if (engine.activeId !== activeId) {
            return;
          }
          paintTune(nodes.get(row.id), tuneBgLook(row.band));
        }, ARCHIVE.tuneLockMs + index * ARCHIVE.tuneStaggerMs);
        engine.timers.push(timer);
      });
    } else if (prev) {
      engine.ranks.forEach((row, index) => {
        const timer = window.setTimeout(() => {
          if (engine.activeId) {
            return;
          }
          const item = items.find((entry) => entry.id === row.id);
          if (item) {
            paintTune(nodes.get(row.id), idleLook(item));
          }
        }, index * ARCHIVE.tuneStaggerMs);
        engine.timers.push(timer);
      });
      const prevItem = items.find((entry) => entry.id === prev);
      if (prevItem) {
        paintTune(nodes.get(prev), idleLook(prevItem));
      }
      engine.ranks = [];
    }
  }

  if (engine.activeId) {
    const node = nodes.get(engine.activeId);
    if (node && !node.classList.contains("arc-win--tune-lock")) {
      paintTune(node, tuneActiveLook());
    }
    return;
  }

  const projects = visible.filter((item) => item.clickable);
  let nearest: {item: ArchiveItem; dist: number} | null = null;
  for (const item of projects) {
    const center = nodeCenter(item.id, nodes, itemRect(item));
    const dist = Math.hypot(pointer.x - center.x, pointer.y - center.y);
    if (!nearest || dist < nearest.dist) {
      nearest = {item, dist};
    }
  }
  const inRange =
    nearest && nearest.dist < ARCHIVE.tuneApproachPx ? nearest : null;
  const nextApproach = inRange?.item.id ?? null;
  if (engine.approachId && engine.approachId !== nextApproach) {
    const prev = items.find((entry) => entry.id === engine.approachId);
    if (prev) {
      paintTune(nodes.get(prev.id), idleLook(prev));
    }
  }
  engine.approachId = nextApproach;
  for (const item of projects) {
    if (item.id === nextApproach && inRange) {
      const raw = 1 - inRange.dist / ARCHIVE.tuneApproachPx;
      const t = raw <= 0 ? 0 : Math.max(0.2, Math.round(raw * 5) / 5);
      paintTune(nodes.get(item.id), approachLook(t));
    } else if (item.id !== engine.approachId) {
      paintTune(nodes.get(item.id), idleLook(item));
    }
  }
}

function lockLook(item: ArchiveItem, step: LockStep) {
  if (step <= 0) {
    return {noise: 0, scale: 1, blur: 0, gray: 0, show: false};
  }
  const residual = item.clickable ? 0 : item.residual;
  return {
    noise: residual,
    scale: 1,
    blur: step >= 3 && residual > 0 ? 0.4 : 0,
    gray: residual > 0 ? 0.2 : 0,
    show: true,
  };
}

function measureDeskSlot(
  item: ArchiveItem,
  plane: HTMLElement,
): Rect {
  const rect = itemRect(item);
  const ghost = document.createElement("div");
  ghost.style.cssText = [
    "position:absolute",
    `left:${rect.x}px`,
    `top:${rect.y}px`,
    `width:${rect.w}px`,
    `height:${rect.h}px`,
    `transform:rotateX(${item.tiltX}deg) rotateZ(${item.tiltZ}deg)`,
    "transform-origin:center bottom",
    "pointer-events:none",
    "visibility:hidden",
  ].join(";");
  plane.appendChild(ghost);
  const box = ghost.getBoundingClientRect();
  ghost.remove();
  return {x: box.left, y: box.top, w: box.width, h: box.height};
}

function flipInvert(first: DOMRect, last: Rect) {
  const sx = first.width / Math.max(last.w, 1);
  const sy = first.height / Math.max(last.h, 1);
  return `translate(${first.left - last.x}px, ${first.top - last.y}px) scale(${sx}, ${sy})`;
}

function blurFilterId(id: string) {
  return `arc-mblur-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

type ArchiveDesktopProps = {
  projects: Project[];
  openSlug: string | null;
};

export function ArchiveDesktop({projects, openSlug}: ArchiveDesktopProps) {
  const playTransitionSound = usePageTransitionSound();
  const router = useRouter();
  const publishRecall = useContext(ArchiveRecallContext);
  const [recallPhase, setRecallPhase] = useState<RecallPhase>("idle");
  const items = useMemo(() => buildArchiveItems(projects), [projects]);
  const [zMap, setZMap] = useState<Record<string, number>>({});
  const [zTop, setZTop] = useState(1);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [lockMap, setLockMap] = useState<Record<string, LockStep>>({});
  const [tuned, setTuned] = useState(false);
  const [stoodId, setStoodId] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [flip, setFlip] = useState<{id: string; last: Rect; invert: string} | null>(null);
  const [flipPlay, setFlipPlay] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelSide, setPanelSide] = useState<InfoSide>("left");
  const [standPlan, setStandPlan] = useState<StandPlan | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sinkingId, setSinkingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [standReady, setStandReady] = useState(false);
  const [deskShake, setDeskShake] = useState(false);
  const deskRef = useRef<HTMLDivElement>(null);
  const slideByIdRef = useRef<Record<string, {slideMs: number; fromVh: number}>>({});
  const slideStartRef = useRef(new Map<string, number>());
  const motionRef = useRef<Motion | null>(null);
  motionRef.current = motion;
  const pushedRef = useRef(false);
  const prevSlugRef = useRef<string | null>(null);
  const skipIntroRef = useRef(Boolean(openSlug));
  const [ready, setReady] = useState(false);
  const videosRef = useRef(new Map<string, VideoBind>());
  const pointerRef = useRef({x: 0, y: 0, speed: 0, t: 0});
  const recallPhaseRef = useRef<RecallPhase>("idle");
  const flightRef = useRef(new Map<string, Flight>());
  const publishRecallRef = useRef(publishRecall);
  publishRecallRef.current = publishRecall;
  const nodesRef = useRef(new Map<string, HTMLElement>());
  const viewRef = useRef(new Set<string>());
  const ioRef = useRef<IntersectionObserver | null>(null);
  const [viewRev, setViewRev] = useState(0);
  const tuneRef = useRef<TuneEngine>({
    activeId: null,
    approachId: null,
    ranks: [],
    timers: [],
  });
  const stoodRef = useRef<string | null>(null);
  const hoverRef = useRef<{id: string; t: number} | null>(null);
  const panelOpenRef = useRef(false);
  const panelLockRef = useRef(false);
  const panelTimerRef = useRef(0);
  const panelGraceRef = useRef(0);
  const panelOverRef = useRef({win: false, panel: false});
  const autoLayTimerRef = useRef(0);
  const autoLayWaitRef = useRef(0);
  const returnLockRef = useRef(false);
  const clickStandRef = useRef<string | null>(null);
  const returningRef = useRef<string | null>(null);
  const returnStartRef = useRef(0);
  panelOpenRef.current = panelOpen;
  returningRef.current = returningId;
  const standLockRef = useRef(false);
  const standWindowRef = useRef<(id: string) => void>(() => {});
  const beginAutoReturnRef = useRef<(id: string) => void>(() => {});
  const itemsRef = useRef(items);
  const lockMapRef = useRef(lockMap);
  const tunedRef = useRef(tuned);
  const openRef = useRef(openSlug);
  const openIdRef = useRef<string | null>(null);
  itemsRef.current = items;
  lockMapRef.current = lockMap;
  tunedRef.current = tuned;
  openRef.current = openSlug;
  openIdRef.current = openId;
  stoodRef.current = stoodId;
  const windowAudioRef = useRef<"bed" | "muffle" | "picture">("bed");
  const heardWinRef = useRef<string | null>(null);

  useEffect(() => {
    SoundEngine.get().bindHearMute(setArchiveHearMuted);
  }, []);

  useEffect(() => {
    if (!stoodId) {
      setStandReady(false);
      setStandPlan(null);
      return;
    }
    setStandReady(false);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setStandReady(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stoodId]);

  useEffect(() => {
    if (openSlug || !stoodId || !standReady) {
      return;
    }
    const engine = SoundEngine.get();
    const id = stoodId;
    const prev = heardWinRef.current;
    if (prev && prev !== id) {
      const prevEl = videosRef.current.get(prev)?.el;
      if (prevEl) {
        releaseArchiveAudio(prevEl);
      }
    }
    heardWinRef.current = id;
    if (windowAudioRef.current !== "muffle") {
      engine.beginWindowExpand();
      windowAudioRef.current = "muffle";
    }
    const timer = window.setTimeout(() => {
      if (stoodRef.current !== id || openRef.current) {
        return;
      }
      engine.finishWindowExpand();
      windowAudioRef.current = "picture";
      const el = videosRef.current.get(id)?.el;
      if (el) {
        claimArchiveVideo(el);
      }
    }, ARCHIVE.standMs);
    return () => window.clearTimeout(timer);
  }, [stoodId, standReady, openSlug]);

  useEffect(() => {
    if (openSlug) {
      const el = heardWinRef.current
        ? videosRef.current.get(heardWinRef.current)?.el
        : undefined;
      if (el) {
        releaseArchiveAudio(el);
      }
      heardWinRef.current = null;
      if (windowAudioRef.current !== "picture") {
        SoundEngine.get().pauseArchiveBed();
        windowAudioRef.current = "picture";
      }
      return;
    }
    if (stoodId || windowAudioRef.current === "bed") {
      return;
    }
    const el = heardWinRef.current
      ? videosRef.current.get(heardWinRef.current)?.el
      : undefined;
    if (windowAudioRef.current === "picture" && el) {
      releaseArchiveAudio(el);
    }
    heardWinRef.current = null;
    SoundEngine.get().beginWindowShrink();
    windowAudioRef.current = "muffle";
    const wait = returningId ? ARCHIVE.autoLayMoveMs : ARCHIVE.layMs;
    const timer = window.setTimeout(() => {
      if (stoodRef.current || openRef.current) {
        return;
      }
      SoundEngine.get().finishWindowShrink();
      windowAudioRef.current = "bed";
    }, wait);
    return () => window.clearTimeout(timer);
  }, [stoodId, openSlug, returningId]);

  const clearPanelTimers = () => {
    if (panelTimerRef.current) {
      window.clearTimeout(panelTimerRef.current);
      panelTimerRef.current = 0;
    }
    if (panelGraceRef.current) {
      window.clearTimeout(panelGraceRef.current);
      panelGraceRef.current = 0;
    }
  };

  const clearAutoLayTimers = () => {
    if (autoLayTimerRef.current) {
      window.clearTimeout(autoLayTimerRef.current);
      autoLayTimerRef.current = 0;
    }
    if (autoLayWaitRef.current) {
      window.clearTimeout(autoLayWaitRef.current);
      autoLayWaitRef.current = 0;
    }
  };

  const enterPanelZone = (zone: "win" | "panel") => {
    panelOverRef.current[zone] = true;
    if (panelGraceRef.current) {
      window.clearTimeout(panelGraceRef.current);
      panelGraceRef.current = 0;
    }
    if (!returnLockRef.current) {
      clearAutoLayTimers();
    }
    if (
      returnLockRef.current ||
      panelOpenRef.current ||
      panelLockRef.current ||
      panelTimerRef.current
    ) {
      return;
    }
    panelTimerRef.current = window.setTimeout(() => {
      panelTimerRef.current = 0;
      const id = stoodRef.current;
      if (!id || returnLockRef.current) {
        return;
      }
      panelLockRef.current = true;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (stoodRef.current !== id || returnLockRef.current) {
            panelLockRef.current = false;
            return;
          }
          setPanelOpen(true);
        });
      });
    }, ARCHIVE.infoDwellMs);
  };

  const leavePanelZone = (zone: "win" | "panel") => {
    panelOverRef.current[zone] = false;
    if (panelOverRef.current.win || panelOverRef.current.panel) {
      return;
    }
    clearPanelTimers();
    if (returnLockRef.current || !stoodRef.current) {
      return;
    }
    panelGraceRef.current = window.setTimeout(() => {
      panelGraceRef.current = 0;
      if (panelOverRef.current.win || panelOverRef.current.panel || returnLockRef.current) {
        return;
      }
      const id = stoodRef.current;
      if (!id) {
        return;
      }
      autoLayTimerRef.current = window.setTimeout(() => {
        autoLayTimerRef.current = 0;
        if (panelOverRef.current.win || panelOverRef.current.panel) {
          return;
        }
        beginAutoReturnRef.current(id);
      }, ARCHIVE.autoLayMs);
    }, ARCHIVE.infoLeaveGraceMs);
  };

  useEffect(() => {
    if (!stoodId || openSlug) {
      clearPanelTimers();
      if (!returningRef.current) {
        clearAutoLayTimers();
      }
      panelOverRef.current = {win: false, panel: false};
      panelLockRef.current = false;
      setPanelOpen(false);
      setPanelSide("left");
      return;
    }
    if (hoverRef.current?.id === stoodId) {
      enterPanelZone("win");
    }
  }, [stoodId, openSlug]);

  useEffect(() => {
    if (!stoodId) {
      return;
    }
    const relayout = () => {
      const item = itemsRef.current.find((entry) => entry.id === stoodId);
      if (!item) {
        return;
      }
      const plan = planStandLayout(stoodId, itemRect(item));
      setStandPlan(plan);
      setPanelSide(plan.side);
    };
    window.addEventListener("resize", relayout);
    window.visualViewport?.addEventListener("resize", relayout);
    return () => {
      window.removeEventListener("resize", relayout);
      window.visualViewport?.removeEventListener("resize", relayout);
    };
  }, [stoodId]);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const margin = `${Math.round(ARCHIVE.videoViewMargin * 100)}%`;
    const io = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.win;
          if (!id) {
            continue;
          }
          const on = entry.isIntersecting;
          const has = viewRef.current.has(id);
          if (on && !has) {
            viewRef.current.add(id);
            changed = true;
          } else if (!on && has) {
            viewRef.current.delete(id);
            changed = true;
          }
        }
        if (changed) {
          setViewRev((value) => value + 1);
        }
      },
      {root: null, rootMargin: margin, threshold: 0.01},
    );
    ioRef.current = io;
    nodesRef.current.forEach((node) => io.observe(node));
    return () => {
      io.disconnect();
      ioRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (skipIntroRef.current) {
      const next: Record<string, LockStep> = {};
      for (const item of items) {
        next[item.id] = 3;
      }
      setLockMap(next);
      return;
    }
    setTuned(false);
    setDeskShake(false);
    const plan = buildSpawnPlan(items);
    const byId: Record<string, {slideMs: number; fromVh: number}> = {};
    for (const event of plan) {
      byId[event.id] = {slideMs: event.slideMs, fromVh: event.fromVh};
    }
    slideByIdRef.current = byId;
    slideStartRef.current.clear();
    const delay = ARCHIVE.windowDelay;
    const timers: number[] = [];
    const pending = {n: plan.length};
    const finish = () => {
      setTuned(true);
      setDeskShake(true);
    };
    for (const event of plan) {
      timers.push(
        window.setTimeout(() => {
          slideStartRef.current.set(event.id, performance.now());
          setLockMap((prev) => ({...prev, [event.id]: 1}));
        }, delay + event.appearAt),
      );
      timers.push(
        window.setTimeout(() => {
          slideStartRef.current.delete(event.id);
          const blur = document
            .getElementById(blurFilterId(event.id))
            ?.querySelector("feGaussianBlur");
          blur?.setAttribute("stdDeviation", "0 0");
          setLockMap((prev) => ({...prev, [event.id]: 3}));
          pending.n -= 1;
          if (pending.n <= 0) {
            finish();
          }
        }, delay + event.appearAt + event.slideMs),
      );
    }
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [ready, items]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const prev = prevSlugRef.current;
    prevSlugRef.current = openSlug;
    if (skipIntroRef.current && openSlug) {
      skipIntroRef.current = false;
      const first = items
        .filter((entry) => entry.slug === openSlug && entry.clickable)
        .sort((a, b) => (a.clipIndex ?? 99) - (b.clipIndex ?? 99))[0];
      if (first) {
        setOpenId(first.id);
      }
      return;
    }
    if (!openSlug && prev) {
      setTuned(true);
      setStoodId(null);
      setSinkingId(null);
    }
    if (openSlug && openSlug !== prev) {
      const item =
        items.find((entry) => entry.id === stoodRef.current && entry.slug === openSlug) ??
        items
          .filter((entry) => entry.slug === openSlug && entry.clickable)
          .sort((a, b) => (a.clipIndex ?? 99) - (b.clipIndex ?? 99))[0];
      if (!item) {
        return;
      }
      setOpenId(item.id);
      setZTop((value) => {
        setZMap((current) => ({...current, [item.id]: value + 1}));
        return value + 1;
      });
      setMotion({
        slug: openSlug,
        dir: "in",
        from: itemRect(item),
        to: fullRect(),
        step: 0,
        glitch: true,
      });
      return;
    }
    if (!openSlug && prev && motionRef.current?.dir !== "out") {
      const item =
        items.find((entry) => entry.id === openId) ??
        items.find((entry) => entry.slug === prev);
      if (!item) {
        return;
      }
      setMotion({
        slug: prev,
        dir: "out",
        from: fullRect(),
        to: itemRect(item),
        step: 0,
        glitch: true,
      });
    }
  }, [openSlug, openId, items, ready]);

  useEffect(() => {
    if (!motion) {
      return;
    }
    const timers = STEPS.map((_, index) => {
      if (index === 0) {
        return 0;
      }
      return window.setTimeout(() => {
        setMotion((prev) =>
          prev
            ? {
                ...prev,
                step: index as 0 | 1 | 2 | 3,
                glitch: index < 3 && prev.dir === "in" ? prev.glitch : index < 2,
              }
            : prev,
        );
      }, STEP_MS[index]);
    });
    const done = window.setTimeout(() => {
      const current = motionRef.current;
      if (current?.dir === "out") {
        setOpenId(null);
        setMotion(null);
        return;
      }
      setMotion((prev) => (prev ? {...prev, glitch: false, step: 3} : prev));
    }, 180);
    const glitchOff = window.setTimeout(() => {
      setMotion((prev) => (prev ? {...prev, glitch: false} : prev));
    }, 120);
    return () => {
      timers.forEach((id) => {
        if (id) {
          window.clearTimeout(id);
        }
      });
      window.clearTimeout(done);
      window.clearTimeout(glitchOff);
    };
  }, [motion?.slug, motion?.dir]);

  useEffect(() => {
    let raf = 0;
    pointerRef.current = {
      x: window.innerWidth * 0.5,
      y: (window.visualViewport?.height ?? window.innerHeight) * 0.5,
      speed: 0,
      t: 0,
    };
    const samples: {x: number; y: number; t: number}[] = [];
    const timers: number[] = [];
    const mark = (phase: RecallPhase) => {
      recallPhaseRef.current = phase;
      if (phase === "idle") {
        delete document.body.dataset.recall;
        document.documentElement.style.removeProperty("--arc-recall-lift");
        document.documentElement.style.removeProperty("--arc-recall-shake");
      } else {
        document.body.dataset.recall = phase;
      }
      publishRecallRef.current(phase);
      setRecallPhase(phase);
    };
    const beginRecall = () => {
      const phase = recallPhaseRef.current;
      if (phase !== "idle" && phase !== "charge") {
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        mark("reveal");
        return;
      }
      const flights = new Map<string, Flight>();
      let maxEnd = 900;
      for (const item of itemsRef.current) {
        const role =
          openIdRef.current === item.id
            ? "detail"
            : stoodRef.current === item.id
              ? "stood"
              : "desk";
        const flight = flightFor(item.id, item.w, item.h, role);
        flights.set(item.id, flight);
        maxEnd = Math.max(maxEnd, flight.delay + flight.dur);
      }
      flightRef.current = flights;
      document.documentElement.style.removeProperty("--arc-recall-shake");
      mark("hitch");
      timers.push(window.setTimeout(() => mark("rise"), 180));
      timers.push(window.setTimeout(() => mark("void"), 180 + maxEnd));
      timers.push(window.setTimeout(() => mark("settle"), 180 + maxEnd + 520));
      timers.push(
        window.setTimeout(() => mark("reveal"), 180 + maxEnd + 520 + 980 + 800),
      );
    };
    const onMove = (event: globalThis.PointerEvent) => {
      const now = performance.now();
      const prev = pointerRef.current;
      const dt = Math.max(8, now - (prev.t || now));
      pointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        speed: Math.hypot(event.clientX - prev.x, event.clientY - prev.y) / dt,
        t: now,
      };
      const phase = recallPhaseRef.current;
      if (phase === "idle" || phase === "charge") {
        pushSample(samples, event.clientX, event.clientY, now);
      }
    };
    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      const pointer = pointerRef.current;
      if (now - pointer.t > 48) {
        pointer.speed *= 0.82;
      }
      if (deskRef.current) {
        deskRef.current.dataset.still = pointer.speed < 0.02 ? "1" : "0";
      }
      const recallNow = recallPhaseRef.current;
      if (recallNow === "idle") {
        const gesture = readShake(samples, now);
        if (gesture.ready) {
          beginRecall();
        }
      }
      const live =
        (recallPhaseRef.current === "idle" || recallPhaseRef.current === "charge") &&
        tunedRef.current &&
        !openRef.current &&
        !motionRef.current;
      if (live && !stoodRef.current) {
        const hit = document.elementFromPoint(pointer.x, pointer.y);
        const node = hit?.closest<HTMLElement>("[data-win]");
        const hid = node?.dataset.win;
        const item = hid
          ? itemsRef.current.find((entry) => entry.id === hid && entry.clickable)
          : null;
        const locked = hid ? (lockMapRef.current[hid] ?? 0) >= 3 : false;
        if (item && locked) {
          if (hoverRef.current?.id !== hid) {
            hoverRef.current = {id: item.id, t: now};
          }
        } else if (hoverRef.current) {
          hoverRef.current = null;
        }
      }
      applyTune(
        pointer,
        live,
        itemsRef.current,
        lockMapRef.current,
        nodesRef.current,
        hoverRef.current?.id ?? null,
        stoodRef.current,
        tuneRef.current,
        returningRef.current,
        returningRef.current
          ? (now - returnStartRef.current) / ARCHIVE.autoLayMoveMs
          : 0,
      );
      const hover = hoverRef.current;
      if (
        live &&
        !stoodRef.current &&
        !returnLockRef.current &&
        hover &&
        hover.id !== stoodRef.current &&
        hover.id !== clickStandRef.current &&
        !standLockRef.current &&
        now - hover.t >= ARCHIVE.standDwellMs
      ) {
        standLockRef.current = true;
        hoverRef.current = {...hover, t: Number.POSITIVE_INFINITY};
        standWindowRef.current(hover.id);
      }
      for (const [id, started] of slideStartRef.current) {
        const slide = slideByIdRef.current[id];
        const node = document
          .getElementById(blurFilterId(id))
          ?.querySelector("feGaussianBlur");
        if (!slide || !node) {
          continue;
        }
        const u = (now - started) / slide.slideMs;
        const n = u >= 1 ? 0 : slideBlurAt(u);
        node.setAttribute("stdDeviation", `0 ${n.toFixed(2)}`);
      }
      driveVideos(videosRef.current, now, {
        previewId: openRef.current ? null : stoodRef.current,
      });
    };
    window.addEventListener("pointermove", onMove);
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      tuneRef.current.timers.forEach((id) => window.clearTimeout(id));
      tuneRef.current.timers = [];
      delete document.body.dataset.recall;
      document.documentElement.style.removeProperty("--arc-recall-lift");
      document.documentElement.style.removeProperty("--arc-recall-shake");
    };
  }, []);

  const standWindow = (id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (item) {
      const plan = planStandLayout(id, itemRect(item));
      setStandPlan(plan);
      setPanelSide(plan.side);
    }
    setStoodId((prev) => {
      if (prev && prev !== id) {
        setSinkingId(prev);
      }
      return id;
    });
    setZMap((prev) => {
      const next = zTop + 1;
      setZTop(next);
      return {...prev, [id]: next};
    });
    window.setTimeout(() => {
      setFlashId(id);
      window.setTimeout(() => {
        setFlashId(null);
        standLockRef.current = false;
      }, 50);
    }, ARCHIVE.standMs);
  };
  standWindowRef.current = standWindow;

  const layWindow = () => {
    const id = stoodRef.current;
    if (!id) {
      return;
    }
    setSinkingId(id);
    setStoodId(null);
    setFlashId(null);
    const node = nodesRef.current.get(id);
    if (node) {
      node.classList.add("arc-win--glitch");
      window.setTimeout(() => node.classList.remove("arc-win--glitch"), 80);
    }
    window.setTimeout(() => {
      setSinkingId((current) => (current === id ? null : current));
      standLockRef.current = false;
    }, ARCHIVE.layMs);
  };

  const flipReturn = (id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id);
    const node = nodesRef.current.get(id);
    const plane = deskRef.current?.querySelector<HTMLElement>(".arc-plane");
    const bind = videosRef.current.get(id);
    if (bind) {
      holdArchiveVideo(bind.el);
    }
    if (!item || !node || !plane) {
      setStoodId(null);
      returnLockRef.current = false;
      return;
    }
    const first = node.getBoundingClientRect();
    const last = measureDeskSlot(item, plane);
    returnLockRef.current = true;
    clickStandRef.current = id;
    returnStartRef.current = performance.now();
    setFlip({id, last, invert: flipInvert(first, last)});
    setFlipPlay(false);
    setReturningId(id);
    setStoodId(null);
    setFlashId(null);
  };

  const beginAutoReturn = (id: string) => {
    if (returnLockRef.current || !stoodRef.current) {
      return;
    }
    returnLockRef.current = true;
    clearPanelTimers();
    clearAutoLayTimers();
    if (panelOpenRef.current) {
      setPanelOpen(false);
      autoLayWaitRef.current = window.setTimeout(() => {
        autoLayWaitRef.current = 0;
        flipReturn(id);
      }, ARCHIVE.infoCloseMs);
      return;
    }
    flipReturn(id);
  };
  beginAutoReturnRef.current = beginAutoReturn;

  useLayoutEffect(() => {
    if (!flip || flipPlay) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setFlipPlay(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [flip, flipPlay]);

  useEffect(() => {
    if (!flip || !flipPlay) {
      return;
    }
    const id = flip.id;
    const done = window.setTimeout(() => {
      const bind = videosRef.current.get(id);
      if (bind) {
        releaseArchiveVideo(bind.el);
      }
      setReturningId(null);
      setFlip(null);
      setFlipPlay(false);
      returnLockRef.current = false;
    }, ARCHIVE.autoLayMoveMs);
    return () => window.clearTimeout(done);
  }, [flip, flipPlay]);

  const close = () => {
    const slug = motion?.slug ?? openSlug;
    const item =
      items.find((entry) => entry.id === openId) ??
      items.find((entry) => entry.slug === slug);
    if (item && slug) {
      const from =
        motion && motion.dir === "in"
          ? mixRect(motion.from, motion.to, STEPS[motion.step])
          : fullRect();
      setMotion({
        slug,
        dir: "out",
        from,
        to: itemRect(item),
        step: 0,
        glitch: true,
      });
    }
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
    } else {
      router.replace("/");
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (openSlug || motionRef.current) {
        event.preventDefault();
        close();
        return;
      }
      if (stoodRef.current) {
        event.preventDefault();
        layWindow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const open = (item: ArchiveItem) => {
    if (openSlug || !item.clickable || (lockMap[item.id] ?? 0) < 3) {
      return;
    }
    if (stoodRef.current !== item.id) {
      return;
    }
    pushedRef.current = true;
    setZMap((prev) => {
      const next = zTop + 1;
      setZTop(next);
      return {...prev, [item.id]: next};
    });
    setOpenId(item.id);
    const index = Math.max(
      0,
      projects.findIndex((project) => project.slug === item.slug),
    );
    playTransitionSound(frequencyForPage(item.slug, index));
    router.push(`/work/${encodeURIComponent(item.slug)}`);
  };

  const bindVideo = (id: string, el: HTMLVideoElement | null, rect: Rect) => {
    if (!el || !el.getAttribute("src")) {
      videosRef.current.delete(id);
      return;
    }
    videosRef.current.set(id, {
      el,
      x: rect.x + rect.w * 0.5,
      y: rect.y + rect.h * 0.5,
    });
    const item = items.find((entry) => entry.id === id);
    cueArchiveVideo(id, el, item?.cueAt ?? ARCHIVE.videoCueAt);
  };

  const recallFlying =
    recallPhase === "rise" ||
    recallPhase === "void" ||
    recallPhase === "settle" ||
    recallPhase === "reveal";
  const recallVars = (id: string): CSSProperties | undefined => {
    if (!recallFlying) {
      return undefined;
    }
    const flight = flightRef.current.get(id);
    if (!flight) {
      return undefined;
    }
    return {
      ["--arc-recall-delay" as string]: `${flight.delay}ms`,
      ["--arc-recall-dur" as string]: `${flight.dur}ms`,
      ["--arc-recall-rot" as string]: `${flight.rot}deg`,
      ["--arc-recall-ease" as string]: flight.ease,
    };
  };

  if (!ready) {
    return null;
  }

  return (
    <div
      ref={deskRef}
      className={["arc-desk", deskShake ? "arc-desk--settle" : ""].join(" ")}
      aria-label="Archive"
      data-still="1"
      onAnimationEnd={(event) => {
        if (event.animationName === "arc-desk-settle") {
          setDeskShake(false);
        }
      }}
      style={{
        perspective: `${ARCHIVE.tiltPerspective}px`,
        perspectiveOrigin: "50% 30%",
        ["--arc-slide-ease" as string]: ARCHIVE.slideEase,
        ["--arc-settle-px" as string]: `${ARCHIVE.slideSettleShakePx}px`,
        ["--arc-settle-ms" as string]: `${ARCHIVE.slideSettleShakeMs}ms`,
      }}
    >
      <div
        className="arc-plane"
        style={{
          transform: `translateY(${ARCHIVE.planeShiftY}px) rotateX(${ARCHIVE.planeTilt}deg)`,
        }}
      >
      <svg className="arc-slide-defs" aria-hidden>
        <defs>
          {items.map((item) => (
            <filter
              key={item.id}
              id={blurFilterId(item.id)}
              x="-20%"
              y="-40%"
              width="140%"
              height="180%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="0 0" />
            </filter>
          ))}
        </defs>
      </svg>
      {items.map((item) => {
        const step = lockMap[item.id] ?? 0;
        const look = lockLook(item, step);
        if (!look.show) {
          return null;
        }
        const isOpen = item.id === openId && Boolean(openSlug || motion);
        const detail = Boolean(isOpen && (openSlug || motion));
        const stood = stoodId === item.id && !detail;
        const returning = returningId === item.id && !detail;
        const dimmed = Boolean(openSlug || motion) && !detail;
        let rect = itemRect(item);
        if (returning && flip && flip.id === item.id) {
          rect = flip.last;
        } else if (motion && isOpen) {
          const t = STEPS[motion.step];
          rect = mixRect(motion.from, motion.to, t);
        } else if (isOpen && openSlug && (!motion || motion.dir === "in")) {
          rect = fullRect();
        }
        const live = item.clickable && step >= 3 && !dimmed;
        const rising = stood && standReady;
        const sinking = sinkingId === item.id && !stood && !returning;
        const sliding = step === 1 && !detail && !stood && !returning;
        const slide = slideByIdRef.current[item.id];
        const mediaLoad =
          stood ||
          returning ||
          detail ||
          (viewRev >= 0 && viewRef.current.has(item.id));
        const fly = recallVars(item.id);
        const article = (
          <article
            key={item.id}
            ref={(el) => {
              if (el) {
                nodesRef.current.set(item.id, el);
                ioRef.current?.observe(el);
              } else {
                const prev = nodesRef.current.get(item.id);
                if (prev) {
                  ioRef.current?.unobserve(prev);
                }
                nodesRef.current.delete(item.id);
              }
            }}
            data-win={item.id}
            className={[
              "arc-win",
              item.clickable ? "arc-win--live" : "arc-win--frag",
              isOpen && motion?.glitch ? "arc-win--glitch" : "",
              sliding ? "arc-win--slide" : "",
              rising ? "arc-win--rise" : "",
              sinking ? "arc-win--sink" : "",
              returning && flipPlay ? "arc-win--return" : "",
              detail ? "arc-win--detail" : "",
              flashId === item.id ? "arc-win--flash" : "",
            ].join(" ")}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              zIndex: stood || returning ? 4 : undefined,
              ["--arc-slide-ms" as string]: `${slide?.slideMs ?? ARCHIVE.slideMsMin}ms`,
              ["--arc-slide-from" as string]: `${slide?.fromVh ?? ARCHIVE.slideFromVhMin}vh`,
              ["--arc-return-ms" as string]: `${ARCHIVE.autoLayMoveMs}ms`,
              ["--arc-return-ease" as string]: ARCHIVE.autoLayEase,
              ...fly,
              filter: [
                sliding ? `url(#${blurFilterId(item.id)})` : null,
                !item.clickable && look.gray > 0 ? `grayscale(${look.gray})` : null,
                !item.clickable && look.blur > 0 ? `blur(${look.blur}px)` : null,
                dimmed ? "brightness(0.3)" : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined,
              transform:
                returning && flip && flip.id === item.id
                  ? flipPlay
                    ? "none"
                    : flip.invert
                  : poseTransform(
                      item,
                      look.scale,
                      stood && standReady,
                      detail,
                      stood && standReady && standPlan?.id === item.id
                        ? standPlan
                        : null,
                    ),
              transformOrigin:
                returning ? "top left" : stood || detail ? "center center" : "center bottom",
              pointerEvents: dimmed || !item.clickable ? "none" : "auto",
            }}
            onPointerEnter={() => {
              if (!item.clickable || step < 3 || openSlug) {
                return;
              }
              hoverRef.current = {id: item.id, t: performance.now()};
              if (stood && !returning) {
                enterPanelZone("win");
              }
            }}
            onPointerLeave={() => {
              if (hoverRef.current?.id === item.id) {
                hoverRef.current = null;
              }
              if (stood && !returning) {
                leavePanelZone("win");
              }
            }}
          >
            <header className="arc-win__bar">
              <button
                type="button"
                className="arc-win__title"
                tabIndex={live ? 0 : -1}
                onClick={() => {
                  if (isOpen && openSlug || returning) {
                    return;
                  }
                  if (stood) {
                    open(item);
                    return;
                  }
                  if (clickStandRef.current === item.id) {
                    clickStandRef.current = null;
                    standWindow(item.id);
                  }
                }}
              >
                {label(item)}
              </button>
              <button
                type="button"
                className="arc-win__x"
                tabIndex={live || (isOpen && openSlug) ? 0 : -1}
                aria-label={isOpen && openSlug ? "Close" : item.title}
                onClick={() => {
                  if (isOpen && openSlug) {
                    close();
                    return;
                  }
                  if (stood) {
                    layWindow();
                  }
                }}
              >
                ×
              </button>
            </header>
            <div
              className="arc-win__body"
              onClick={() => {
                if (isOpen && openSlug || returning) {
                  return;
                }
                if (stood) {
                  open(item);
                  return;
                }
                if (clickStandRef.current === item.id) {
                  clickStandRef.current = null;
                  standWindow(item.id);
                }
              }}
            >
              <div className="arc-win__media">
                {detail && openSlug && item.slug === openSlug && item.clickable ? (
                  <Detail item={item} />
                ) : (
                  <WinBody
                    item={item}
                    bindVideo={bindVideo}
                    rect={rect}
                    load={mediaLoad}
                  />
                )}
              </div>
              <div className="arc-win__noise" style={{opacity: look.noise}} />
              <div className="arc-win__sig" />
              <div className="arc-win__scan" />
              <div className="arc-win__rgb" />
              <div className="arc-win__blank">NO SIGNAL</div>
              <div className="arc-win__idle" />
            </div>
            {!detail ? (
              <footer className="arc-win__stat">
                {item.clickable ? [item.year, item.category].filter(Boolean).join(" · ") : "SIGNAL LOSS"}
              </footer>
            ) : null}
          </article>
        );
        if (detail) {
          return createPortal(
            <div className="arc-portal arc-portal--detail" style={fly}>
              {article}
            </div>,
            document.body,
            item.id,
          );
        }
        if (stood || returning) {
          return createPortal(
            <div className="arc-portal arc-portal--stand" style={fly}>
              {stood ? (
                <InfoPanel
                  item={item}
                  box={
                    standPlan?.id === item.id
                      ? standPlan.box
                      : stoodBox(itemRect(item))
                  }
                  open={panelOpen && stoodId === item.id}
                  side={panelSide}
                  shift={0}
                  barTitle={label(item)}
                  onEnter={() => enterPanelZone("panel")}
                  onLeave={() => leavePanelZone("panel")}
                />
              ) : null}
              {article}
            </div>,
            document.body,
            item.id,
          );
        }
        return article;
      })}
      </div>
      {stoodId || openSlug
        ? createPortal(
            <div className="arc-crt-top" aria-hidden>
              <div className="arc-crt__scan" />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function WinBody({
  item,
  bindVideo,
  rect,
  load,
}: {
  item: ArchiveItem;
  bindVideo: (id: string, el: HTMLVideoElement | null, rect: Rect) => void;
  rect: Rect;
  load: boolean;
}) {
  if (item.video) {
    return (
      <video
        ref={(el) => bindVideo(item.id, el, rect)}
        src={load ? item.video : undefined}
        poster={item.image ?? undefined}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  if (item.image) {
    return (
      <img
        src={item.image}
        alt=""
        style={item.kind === "crop" ? {objectPosition: item.crop, transform: "scale(2.1)"} : undefined}
      />
    );
  }
  return <div className="arc-win__empty">NO SIGNAL</div>;
}

function DetailVideo({
  src,
  poster,
  lead,
}: {
  src: string;
  poster?: string;
  lead: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [barOn, setBarOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.currentTime = 0;
    el.loop = true;
    if (!lead) {
      el.muted = true;
      setMuted(true);
      el.pause();
      return () => {
        el.pause();
        el.currentTime = 0;
      };
    }
    el.muted = false;
    setMuted(false);
    const start = () => {
      const play = el.play();
      if (play) {
        play.catch(() => {
          el.muted = true;
          setMuted(true);
          el.play().catch(() => {});
        });
      }
    };
    if (el.readyState >= 2) {
      start();
    } else {
      el.addEventListener("canplay", start, {once: true});
    }
    const onTime = () => {
      const duration = el.duration;
      setProgress(duration ? el.currentTime / duration : 0);
    };
    const onEnded = () => {
      el.currentTime = 0;
      el.play().catch(() => {});
      setPaused(false);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("canplay", start);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.pause();
      el.currentTime = 0;
    };
  }, [src, lead]);

  const togglePlay = () => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (el.paused) {
      el.play().catch(() => {});
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  };
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  useEffect(() => {
    if (!lead) {
      return;
    }
    const video = ref.current;
    const zone = zoneRef.current;
    if (!video || !zone) {
      return;
    }
    const fit = () => {
      const box = video.getBoundingClientRect();
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh || box.height < 1) {
        zone.style.height = "72px";
        return;
      }
      const scale = Math.min(box.width / vw, box.height / vh);
      const pictureBottom = box.top + (box.height - vh * scale) / 2 + vh * scale;
      const room = box.bottom - pictureBottom - 8;
      const height = room >= 48 ? Math.min(72, room) : Math.max(28, room);
      zone.style.height = `${Math.round(height)}px`;
    };
    fit();
    video.addEventListener("loadedmetadata", fit);
    const observer = new ResizeObserver(fit);
    observer.observe(video);
    return () => {
      video.removeEventListener("loadedmetadata", fit);
      observer.disconnect();
    };
  }, [lead, src]);

  useEffect(() => {
    if (!lead) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") {
        return;
      }
      event.preventDefault();
      togglePlayRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead]);

  const toggleMute = (event: {stopPropagation: () => void}) => {
    event.stopPropagation();
    const el = ref.current;
    if (!el) {
      return;
    }
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const seek = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const el = ref.current;
    if (!el || !el.duration) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    el.currentTime = ((event.clientX - box.left) / Math.max(box.width, 1)) * el.duration;
  };

  const bar = (
    <div
      className="arc-detail__bar"
      onPointerDown={seek}
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
    >
      <i style={{width: `${Math.min(100, Math.max(0, progress * 100))}%`}} />
    </div>
  );

  return (
    <div className="arc-detail__player" data-bar={lead && barOn ? "1" : "0"}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        playsInline
        preload="auto"
        loop
        onClick={togglePlay}
      />
      <button
        type="button"
        className="arc-detail__snd"
        onClick={toggleMute}
        aria-label={muted ? "Sound on" : "Sound off"}
      >
        {muted ? "SND OFF" : "SND ON"}
      </button>
      {lead ? (
        <div
          ref={zoneRef}
          className="arc-detail__bar-zone"
          onPointerEnter={() => setBarOn(true)}
          onPointerLeave={() => setBarOn(false)}
        >
          {bar}
        </div>
      ) : (
        bar
      )}
    </div>
  );
}

function Detail({item}: {item: ArchiveItem}) {
  const clips = item.videos.length ? item.videos : item.video ? [item.video] : [];
  const lead = clips[0];
  const rest = clips.slice(1);
  const extras = lead ? item.images : item.images.slice(1);
  return (
    <div className="arc-detail">
      <div className="arc-detail__hero">
        {lead ? (
          <DetailVideo
            src={lead}
            poster={item.image ?? item.images[0]}
            lead
          />
        ) : item.images[0] ? (
          <img className="arc-detail__hero-img" src={item.images[0]} alt="" />
        ) : null}
        <aside className="arc-detail__meta">
          <h2>{item.projectTitle ?? item.title}</h2>
          <p>{[item.year, item.category].filter(Boolean).join(" · ")}</p>
          {item.shortDescription ? <p>{item.shortDescription}</p> : null}
        </aside>
      </div>
      {rest.length || extras.length ? (
        <div className="arc-detail__more">
          {rest.map((url) => (
            <DetailVideo
              key={url}
              src={url}
              poster={item.image ?? item.images[0]}
              lead={false}
            />
          ))}
          {extras.map((url) => (
            <img key={url} src={url} alt="" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
