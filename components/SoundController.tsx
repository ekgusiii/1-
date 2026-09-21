"use client";

import {VT323} from "next/font/google";
import {useCallback, useEffect, useState} from "react";

import {SoundEngine} from "@/lib/sound/SoundEngine";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sound-vt",
  display: "swap",
});

export function SoundController() {
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);

  const tuneIn = useCallback(async () => {
    const engine = SoundEngine.get();
    await engine.start();
    setStarted(true);
    setMuted(engine.isMuted);
  }, []);

  useEffect(() => {
    const onFirst = () => {
      void tuneIn();
    };
    window.addEventListener("pointerdown", onFirst, {once: true, capture: true});
    return () => {
      window.removeEventListener("pointerdown", onFirst, true);
    };
  }, [tuneIn]);

  const toggle = async () => {
    const engine = SoundEngine.get();
    if (!engine.isStarted) {
      await engine.start();
      setStarted(true);
    }
    const next = !engine.isMuted;
    engine.setMuted(next);
    setMuted(next);
  };

  return (
    <div className={`${vt323.variable} sound-ui`}>
      {!started ? (
        <p className="sound-ui__tune">▸ CLICK TO TUNE IN</p>
      ) : null}
      {started ? (
        <button
          type="button"
          className="sound-ui__toggle"
          onClick={() => {
            void toggle();
          }}
        >
          SOUND {muted ? "OFF" : "ON"}
        </button>
      ) : null}
    </div>
  );
}
