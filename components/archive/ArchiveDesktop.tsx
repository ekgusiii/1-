"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useRouter} from "next/navigation";

import {ARCHIVE} from "@/components/archive/archiveConfig";
import {SLIDE_EASE, slideBlurAt} from "@/components/archive/archiveSpring";
import {buildArchiveItems, type ArchiveItem} from "@/components/archive/archiveItems";
import {buildSpawnPlan} from "@/components/archive/archiveSpawn";
import {
  approachLook,
  idleLook,
  nodeCenter,
  paintTune,
  playTuneLock,
  rankFromOrigin,
  tuneActiveLook,
  tuneBgLook,
  type TuneRank,
} from "@/components/archive/archiveTune";
import {cueArchiveVideo, driveVideos, type VideoBind} from "@/components/archive/archiveVideos";
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

function label(title: string) {
  return title.toUpperCase().endsWith(".MOV") ? title.toUpperCase() : `${title.toUpperCase()}.MOV`;
}

function poseTransform(item: ArchiveItem, scale: number, stood: boolean, detail: boolean) {
  if (detail) {
    return "none";
  }
  if (stood) {
    return `rotateX(0deg) rotateZ(0deg) scale(${ARCHIVE.standScale})`;
  }
  return `rotateX(${item.tiltX}deg) rotateZ(${item.tiltZ}deg) translateZ(var(--arc-tune-z, 0px)) scale(calc(${scale} * var(--arc-tune-scale, 1)))`;
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
) {
  const visible = visibleItems(items, lockMap);
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

function blurFilterId(id: string) {
  return `arc-mblur-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

type ArchiveDesktopProps = {
  projects: Project[];
  openSlug: string | null;
};

export function ArchiveDesktop({projects, openSlug}: ArchiveDesktopProps) {
  const router = useRouter();
  const items = useMemo(() => buildArchiveItems(projects), [projects]);
  const [zMap, setZMap] = useState<Record<string, number>>({});
  const [zTop, setZTop] = useState(1);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [lockMap, setLockMap] = useState<Record<string, LockStep>>({});
  const [tuned, setTuned] = useState(false);
  const [stoodId, setStoodId] = useState<string | null>(null);
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
  const nodesRef = useRef(new Map<string, HTMLElement>());
  const tuneRef = useRef<TuneEngine>({
    activeId: null,
    approachId: null,
    ranks: [],
    timers: [],
  });
  const stoodRef = useRef<string | null>(null);
  const hoverRef = useRef<{id: string; t: number} | null>(null);
  const standLockRef = useRef(false);
  const standWindowRef = useRef<(id: string) => void>(() => {});
  const itemsRef = useRef(items);
  const lockMapRef = useRef(lockMap);
  const tunedRef = useRef(tuned);
  const openRef = useRef(openSlug);
  itemsRef.current = items;
  lockMapRef.current = lockMap;
  tunedRef.current = tuned;
  openRef.current = openSlug;
  stoodRef.current = stoodId;

  useEffect(() => {
    if (!stoodId) {
      setStandReady(false);
      return;
    }
    setStandReady(false);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setStandReady(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stoodId]);

  useEffect(() => {
    setReady(true);
  }, []);

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
      return;
    }
    if (!openSlug && prev) {
      setTuned(true);
      setStoodId(null);
      setSinkingId(null);
    }
    if (openSlug && openSlug !== prev) {
      const item = items.find((entry) => entry.slug === openSlug && entry.clickable);
      if (!item) {
        return;
      }
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
      const item = items.find((entry) => entry.slug === prev);
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
  }, [openSlug, items, ready]);

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
      setMotion((prev) => {
        if (!prev) {
          return prev;
        }
        if (prev.dir === "out") {
          return null;
        }
        return {...prev, glitch: false, step: 3};
      });
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
    let last = 0;
    let raf = 0;
    pointerRef.current = {
      x: window.innerWidth * 0.5,
      y: (window.visualViewport?.height ?? window.innerHeight) * 0.5,
      speed: 0,
      t: 0,
    };
    const onMove = (event: PointerEvent) => {
      const now = performance.now();
      const prev = pointerRef.current;
      const dt = Math.max(8, now - (prev.t || now));
      pointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        speed: Math.hypot(event.clientX - prev.x, event.clientY - prev.y) / dt,
        t: now,
      };
    };
    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      const dt = last ? Math.min(40, now - last) : 16;
      last = now;
      const pointer = pointerRef.current;
      if (now - pointer.t > 48) {
        pointer.speed *= 0.82;
      }
      if (deskRef.current) {
        deskRef.current.dataset.still = pointer.speed < 0.02 ? "1" : "0";
      }
      const live = tunedRef.current && !openRef.current && !motionRef.current;
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
            hoverRef.current = {id: hid, t: now};
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
      );
      const hover = hoverRef.current;
      if (
        live &&
        !stoodRef.current &&
        hover &&
        hover.id !== stoodRef.current &&
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
      driveVideos(videosRef.current, pointer, dt, {
        enabled: live || Boolean(openRef.current),
        stoodId: openRef.current
          ? itemsRef.current.find((item) => item.slug === openRef.current)?.id ?? null
          : stoodRef.current,
        focusId: stoodRef.current ?? hoverRef.current?.id ?? null,
        lossOf: () => 0,
        dead: () => false,
      });
    };
    window.addEventListener("pointermove", onMove);
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(raf);
      tuneRef.current.timers.forEach((id) => window.clearTimeout(id));
      tuneRef.current.timers = [];
    };
  }, []);

  const standWindow = (id: string) => {
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

  const close = () => {
    const slug = motion?.slug ?? openSlug;
    const item = items.find((entry) => entry.slug === slug);
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
    router.push(`/work/${encodeURIComponent(item.slug)}`);
  };

  const bindVideo = (id: string, el: HTMLVideoElement | null, rect: Rect) => {
    if (!el) {
      videosRef.current.delete(id);
      return;
    }
    videosRef.current.set(id, {
      el,
      x: rect.x + rect.w * 0.5,
      y: rect.y + rect.h * 0.5,
    });
    cueArchiveVideo(id, el);
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
        ["--arc-slide-ease" as string]: SLIDE_EASE,
        ["--arc-slide-fade" as string]: ARCHIVE.slideFadeUntil,
        ["--arc-settle-px" as string]: `${ARCHIVE.slideSettleShakePx}px`,
        ["--arc-settle-ms" as string]: `${ARCHIVE.slideSettleShakeMs}ms`,
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
        const isOpen = item.slug === openSlug || motion?.slug === item.slug;
        const detail = Boolean(isOpen && (openSlug || motion));
        const stood = stoodId === item.id && !detail;
        const dimmed = Boolean(openSlug || motion) && !detail;
        let rect = itemRect(item);
        if (motion && motion.slug === item.slug) {
          const t = STEPS[motion.step];
          rect = mixRect(motion.from, motion.to, t);
        } else if (isOpen && openSlug && (!motion || motion.dir === "in")) {
          rect = fullRect();
        }
        const live = item.clickable && step >= 3 && !dimmed;
        const rising = stood && standReady;
        const sinking = sinkingId === item.id && !stood;
        const sliding = step === 1 && !detail && !stood;
        const slide = slideByIdRef.current[item.id];
        const article = (
          <article
            key={item.id}
            ref={(el) => {
              if (el) {
                nodesRef.current.set(item.id, el);
              } else {
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
              flashId === item.id ? "arc-win--flash" : "",
            ].join(" ")}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              zIndex: stood ? 4 : undefined,
              ["--arc-slide-ms" as string]: `${slide?.slideMs ?? ARCHIVE.slideMsMin}ms`,
              ["--arc-slide-from" as string]: `${slide?.fromVh ?? ARCHIVE.slideFromVhMin}vh`,
              filter: [
                sliding ? `url(#${blurFilterId(item.id)})` : null,
                !item.clickable && look.gray > 0 ? `grayscale(${look.gray})` : null,
                !item.clickable && look.blur > 0 ? `blur(${look.blur}px)` : null,
                dimmed ? "brightness(0.3)" : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined,
              transform: poseTransform(
                item,
                look.scale,
                stood && standReady,
                detail,
              ),
              transformOrigin: stood || detail ? "center center" : "center bottom",
              pointerEvents: dimmed || !item.clickable ? "none" : "auto",
            }}
            onPointerEnter={() => {
              if (!item.clickable || step < 3 || openSlug) {
                return;
              }
              hoverRef.current = {id: item.id, t: performance.now()};
            }}
            onPointerLeave={() => {
              if (hoverRef.current?.id === item.id) {
                hoverRef.current = null;
              }
            }}
          >
            <header className="arc-win__bar">
              <button
                type="button"
                className="arc-win__title"
                tabIndex={live ? 0 : -1}
                onClick={() => {
                  if (isOpen && openSlug) {
                    return;
                  }
                  if (stood) {
                    open(item);
                  }
                }}
              >
                {label(item.title)}
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
                if (isOpen && openSlug) {
                  return;
                }
                if (stood) {
                  open(item);
                }
              }}
            >
              <div className="arc-win__media">
                {detail && openSlug && item.slug === openSlug && item.clickable ? (
                  <Detail item={item} bindVideo={bindVideo} rect={rect} />
                ) : (
                  <WinBody item={item} bindVideo={bindVideo} rect={rect} />
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
            <div className="arc-portal arc-portal--detail">{article}</div>,
            document.body,
            item.id,
          );
        }
        if (stood) {
          return createPortal(
            <div className="arc-portal arc-portal--stand">{article}</div>,
            document.body,
            item.id,
          );
        }
        return article;
      })}
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
}: {
  item: ArchiveItem;
  bindVideo: (id: string, el: HTMLVideoElement | null, rect: Rect) => void;
  rect: Rect;
}) {
  if (item.kind === "bar") {
    return <div className="arc-win__empty">NO DATA</div>;
  }
  if (item.kind === "noise") {
    return <div className="arc-win__empty"> </div>;
  }
  if (item.video) {
    return (
      <video
        ref={(el) => bindVideo(item.id, el, rect)}
        src={item.video}
        poster={item.image ?? undefined}
        muted
        playsInline
        preload="auto"
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

function Detail({
  item,
  bindVideo,
  rect,
}: {
  item: ArchiveItem;
  bindVideo: (id: string, el: HTMLVideoElement | null, rect: Rect) => void;
  rect: Rect;
}) {
  return (
    <div className="arc-detail">
      <aside className="arc-detail__meta">
        <h2>{item.title}</h2>
        <p>{[item.year, item.category].filter(Boolean).join(" · ")}</p>
        {item.shortDescription ? <p>{item.shortDescription}</p> : null}
      </aside>
      <div className="arc-detail__media">
        {item.videos.map((url, index) => (
          <video
            key={url}
            ref={(el) => bindVideo(`${item.id}-d-${index}`, el, rect)}
            src={url}
            poster={item.image ?? item.images[0]}
            muted
            playsInline
            preload="auto"
          />
        ))}
        {item.images.map((url) => (
          <img key={url} src={url} alt="" />
        ))}
      </div>
    </div>
  );
}
