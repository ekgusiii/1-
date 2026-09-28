"use client";

import {useCallback, useRef} from "react";

import {SoundEngine} from "@/lib/sound/SoundEngine";

export function usePageTransitionSound(pageFrequency?: number) {
  const frequencyRef = useRef(pageFrequency);
  frequencyRef.current = pageFrequency;

  return useCallback((nextFrequency?: number) => {
    const frequency = nextFrequency ?? frequencyRef.current;
    if (frequency == null || !Number.isFinite(frequency) || frequency <= 0) {
      return;
    }
    const engine = SoundEngine.get();
    void engine.start().then(() => {
      engine.playPageTransition(frequency);
    });
  }, []);
}
