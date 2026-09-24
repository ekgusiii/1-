import {useLayoutEffect, useState} from "react";

import {ARCHIVE} from "@/components/archive/archiveConfig";
import type {ArchiveItem} from "@/components/archive/archiveItems";

export type InfoSide = "left" | "right";

type InfoPanelProps = {
  item: ArchiveItem;
  box: {x: number; y: number; w: number; h: number};
  open: boolean;
  side: InfoSide;
  shift: number;
  barTitle: string;
  onEnter: () => void;
  onLeave: () => void;
};

export function decidePanelSide(winX: number): InfoSide {
  return winX >= ARCHIVE.infoWidth + ARCHIVE.infoEdge ? "left" : "right";
}

function infoTitle(item: ArchiveItem, barTitle: string) {
  const raw = (barTitle || item.filename || item.title || "FILE").toUpperCase();
  const base = raw.replace(/\.[^.]+$/, "");
  return `${base}.TXT`;
}

export function InfoPanel({item, box, open, side, shift, barTitle, onEnter, onLeave}: InfoPanelProps) {
  const [flush, setFlush] = useState(box);
  const lines = [
    item.projectTitle ?? item.title,
    item.year != null ? String(item.year) : null,
    item.role,
    item.description,
  ].filter((line): line is string => Boolean(line));

  useLayoutEffect(() => {
    const win = document.querySelector<HTMLElement>(`[data-win="${item.id}"]`);
    if (!win) {
      setFlush(box);
      return;
    }
    const rect = win.getBoundingClientRect();
    setFlush({x: rect.left, y: rect.top, w: rect.width, h: rect.height});
  }, [item.id, open, side, shift, box.x, box.y, box.w, box.h]);

  return (
    <aside
      className="arc-info"
      data-open={open ? "1" : "0"}
      data-side={side}
      style={{
        left: side === "right" ? flush.x + flush.w : flush.x - ARCHIVE.infoWidth,
        top: flush.y,
        width: ARCHIVE.infoWidth,
        height: flush.h,
        ["--arc-info-open-ms" as string]: `${ARCHIVE.infoOpenMs}ms`,
        ["--arc-info-open-ease" as string]: ARCHIVE.infoOpenEase,
        ["--arc-info-close-ms" as string]: `${ARCHIVE.infoCloseMs}ms`,
        ["--arc-info-close-ease" as string]: ARCHIVE.infoCloseEase,
        ["--arc-info-text-lift" as string]: `${ARCHIVE.infoTextLift}px`,
        ["--arc-info-bar-pad" as string]: `${ARCHIVE.infoBarPadX}px`,
      }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <div className="arc-info__sheet">
        <header className="arc-win__bar">
          <span className="arc-win__title">{infoTitle(item, barTitle)}</span>
        </header>
        <div className="arc-info__body">
          {lines.map((text, index) => (
            <p
              key={`${index}-${text.slice(0, 24)}`}
              className={index === lines.length - 1 && item.description ? "arc-info__line arc-info__line--body" : "arc-info__line"}
              style={{
                ["--arc-info-delay" as string]: `${ARCHIVE.infoTextDelay + index * ARCHIVE.infoTextStagger}ms`,
              }}
            >
              {text}
            </p>
          ))}
          <div className="arc-info__scan" />
        </div>
      </div>
    </aside>
  );
}
