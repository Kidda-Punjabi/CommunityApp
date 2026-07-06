"use client";

import { useEffect, useRef } from "react";
import type { SoundName } from "@/lib/audio/sound-types";
import { useAudioManager } from "@/lib/audio/audio-manager";

export function usePlaySoundOnce(name: SoundName, when = true) {
  const { playSound } = useAudioManager();
  const playedRef = useRef(false);

  useEffect(() => {
    if (!when || playedRef.current) return;
    playedRef.current = true;
    playSound(name);
  }, [when, name, playSound]);
}

export function usePlaySoundOnChange(
  trigger: "correct" | "incorrect" | null | undefined
) {
  const { playSound } = useAudioManager();
  const lastRef = useRef<typeof trigger>(null);

  useEffect(() => {
    if (!trigger || trigger === lastRef.current) return;
    lastRef.current = trigger;
    playSound(trigger);
  }, [trigger, playSound]);
}
