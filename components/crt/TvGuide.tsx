"use client";

import type { GuideProgram } from "@/components/crt/projectPreview";

type TvGuideProps = {
  programs: GuideProgram[];
  onSelect: (program: GuideProgram) => void;
};

export function TvGuide({ programs, onSelect }: TvGuideProps) {
  return (
    <div className="epg" aria-label="TV program guide">
      <svg className="epg__svgdefs" aria-hidden="true">
        <filter
          id="epg-refract"
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            id="epg-disp"
            result="map"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          />
          <feDisplacementMap
            id="epg-disp-map"
            in="SourceGraphic"
            in2="map"
            scale="10"
            xChannelSelector="R"
            yChannelSelector="G"
            result="warp"
          />
          <feOffset in="warp" dx="-1.2" dy="0" result="shiftR" />
          <feOffset in="warp" dx="1.2" dy="0" result="shiftB" />
          <feColorMatrix
            in="shiftR"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.4 0"
            result="onlyR"
          />
          <feColorMatrix
            in="shiftB"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0.4 0"
            result="onlyB"
          />
          <feBlend in="warp" in2="onlyR" mode="screen" result="wr" />
          <feBlend in="wr" in2="onlyB" mode="screen" />
        </filter>
      </svg>
      <div className="epg__inner">
        <div className="epg__lens">
          <div className="epg__header">
            <span className="epg__brand">TV GUIDE</span>
            <span className="epg__clock">8:00 PM</span>
          </div>
          <div className="epg__times" aria-hidden="true">
            <span className="epg__times-ch">CH</span>
            <span>8:00</span>
            <span>8:30</span>
            <span>9:00</span>
          </div>
          <div className="epg__body">
            {programs.length === 0 ? (
              <div className="epg__empty">NO PROGRAMS</div>
            ) : (
              programs.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  className="epg__row"
                  onClick={() => onSelect(program)}
                >
                  <span className="epg__ch">{program.channel}</span>
                  <span className="epg__title">{program.title}</span>
                  <span className="epg__slot">{program.time}</span>
                </button>
              ))
            )}
          </div>
          <div className="epg__footer">SELECT PROGRAM  •  ENTER TO PLAY</div>
        </div>
      </div>
    </div>
  );
}
