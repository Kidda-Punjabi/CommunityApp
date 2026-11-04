"use client";

import { useCallback } from "react";
import { useAudioManager } from "@/lib/audio/audio-manager";

/** Practise-only cues. Short, soft and in one family, and they obey the app's sound setting. */
type Note = [frequency: number, start: number, duration: number, gain: number, type?: OscillatorType];

const CUES = {
  tap: [[520, 0, 0.035, 0.07]],
  correct: [[659.25, 0, 0.1, 0.24, "triangle"], [987.77, 0.085, 0.17, 0.22, "triangle"]],
  wrong: [[233.08, 0, 0.13, 0.16, "sine"], [196, 0.1, 0.18, 0.13, "sine"]],
  combo: [[659.25, 0, 0.08, 0.2, "triangle"], [830.61, 0.07, 0.08, 0.2, "triangle"], [1108.73, 0.14, 0.2, 0.2, "triangle"]],
  finish: [[523.25, 0, 0.11, 0.2, "triangle"], [659.25, 0.1, 0.11, 0.2, "triangle"], [783.99, 0.2, 0.11, 0.2, "triangle"], [1046.5, 0.3, 0.3, 0.2, "triangle"]],
  streak: [[587.33, 0, 0.13, 0.18, "sine"], [880, 0.12, 0.28, 0.2, "sine"]],
  levelUp: [[523.25, 0, 0.12, 0.22, "triangle"], [659.25, 0.12, 0.12, 0.22, "triangle"], [783.99, 0.24, 0.12, 0.22, "triangle"], [1046.5, 0.36, 0.14, 0.24, "triangle"], [1318.51, 0.5, 0.4, 0.22, "triangle"]],
} satisfies Record<string, Note[]>;

export type PractiseCue = keyof typeof CUES;

let context: AudioContext | null = null;

export function usePractiseSound() {
  const { soundEnabled, soundVolume } = useAudioManager();
  return useCallback(
    (cue: PractiseCue) => {
      if (!soundEnabled || soundVolume <= 0 || typeof window === "undefined") return;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      context ??= new Ctx();
      void context.resume().catch(() => undefined);
      const now = context.currentTime;
      for (const [frequency, start, duration, gain, type] of CUES[cue] as Note[]) {
        const osc = context.createOscillator();
        const amp = context.createGain();
        osc.type = type ?? "sine";
        osc.frequency.setValueAtTime(frequency, now + start);
        amp.gain.setValueAtTime(0.0001, now + start);
        amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain * soundVolume), now + start + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        osc.connect(amp).connect(context.destination);
        osc.start(now + start);
        osc.stop(now + start + duration + 0.02);
      }
    },
    [soundEnabled, soundVolume]
  );
}
