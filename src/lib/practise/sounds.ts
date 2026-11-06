"use client";

import { useCallback } from "react";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { getAudioContext, whenAudioReady } from "@/lib/audio/synthesize-sound";
import { isNativeApp } from "@/lib/native/platform";

/** Practise-only cues. Short, soft and in one family, and they obey the app's sound setting. */
type Note = [frequency: number, start: number, duration: number, gain: number, type?: OscillatorType];

const CUES = {
  tap: [[520, 0, 0.035, 0.07]],
  correct: [[659.25, 0, 0.1, 0.24, "triangle"], [987.77, 0.085, 0.17, 0.22, "triangle"]],
  wrong: [[233.08, 0, 0.13, 0.16, "sine"], [196, 0.1, 0.18, 0.13, "sine"]],
  combo: [[659.25, 0, 0.08, 0.2, "triangle"], [830.61, 0.07, 0.08, 0.2, "triangle"], [1108.73, 0.14, 0.2, 0.2, "triangle"]],
  finish: [[523.25, 0, 0.11, 0.2, "triangle"], [659.25, 0.1, 0.11, 0.2, "triangle"], [783.99, 0.2, 0.11, 0.2, "triangle"], [1046.5, 0.3, 0.3, 0.2, "triangle"]],
  levelUp: [[523.25, 0, 0.12, 0.22, "triangle"], [659.25, 0.12, 0.12, 0.22, "triangle"], [783.99, 0.24, 0.12, 0.22, "triangle"], [1046.5, 0.36, 0.14, 0.24, "triangle"], [1318.51, 0.5, 0.4, 0.22, "triangle"]],
} satisfies Record<string, Note[]>;

export type PractiseCue = keyof typeof CUES;

export function usePractiseSound() {
  const { soundEnabled, soundVolume } = useAudioManager();
  return useCallback(
    (cue: PractiseCue) => {
      if (!soundEnabled || soundVolume <= 0 || typeof window === "undefined") return;
      const ctx = getAudioContext();
      if (!ctx) return;
      whenAudioReady(ctx, () => {
        const now = ctx.currentTime;
        for (const [frequency, start, duration, gain, type] of CUES[cue] as Note[]) {
          const osc = ctx.createOscillator();
          const amp = ctx.createGain();
          osc.type = type ?? "sine";
          osc.frequency.setValueAtTime(frequency, now + start);
          amp.gain.setValueAtTime(0.0001, now + start);
          amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain * soundVolume), now + start + 0.012);
          amp.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
          osc.connect(amp).connect(ctx.destination);
          osc.start(now + start);
          osc.stop(now + start + duration + 0.02);
        }
      });
    },
    [soundEnabled, soundVolume]
  );
}

/**
 * The streak moment. Timed to the flame screen so the sound and the picture land together:
 * the flame catches (0.25s), bursts with sparks (0.85s), the number flips (1.0s) and today's tick lands (1.25s).
 */
function playStreakFanfare(ctx: AudioContext, volume: number) {
  const t0 = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);

  const tone = (freq: number, at: number, dur: number, gain: number, type: OscillatorType = "triangle", bendTo?: number) => {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0 + at);
    if (bendTo) osc.frequency.exponentialRampToValueAtTime(bendTo, t0 + at + dur * 0.6);
    amp.gain.setValueAtTime(0.0001, t0 + at);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + at + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    osc.connect(amp).connect(out);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.03);
  };

  // 1. Whoosh: filtered noise rising as the flame catches.
  const len = Math.floor(ctx.sampleRate * 0.8);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(300, t0 + 0.25);
  filter.frequency.exponentialRampToValueAtTime(3200, t0 + 0.85);
  const whoosh = ctx.createGain();
  whoosh.gain.setValueAtTime(0.0001, t0 + 0.25);
  whoosh.gain.exponentialRampToValueAtTime(0.16, t0 + 0.7);
  whoosh.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
  noise.connect(filter).connect(whoosh).connect(out);
  noise.start(t0 + 0.25);
  noise.stop(t0 + 1.05);

  // 2. Rising run into the burst.
  [392, 523.25, 659.25].forEach((f, i) => tone(f, 0.5 + i * 0.09, 0.12, 0.13));

  // 3. Burst: a bright major chord with a low thump underneath, as the sparks fly.
  tone(130.81, 0.85, 0.32, 0.3, "sine", 65);
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 0.85, 0.7, 0.09));
  [1046.5, 783.99].forEach((f) => tone(f, 0.85, 0.5, 0.05, "sine"));

  // 4. Sparkle shimmer on top of the chord.
  [2093, 2637, 3136, 2637, 3520].forEach((f, i) => tone(f, 0.9 + i * 0.045, 0.14, 0.035, "sine"));

  // 5. The number flips, then today's tick lands.
  tone(880, 1.0, 0.09, 0.12, "sine", 1320);
  tone(1318.51, 1.25, 0.12, 0.12, "triangle");
  tone(1975.53, 1.31, 0.3, 0.08, "sine");
}

/** Plays the full streak celebration. Call it when the streak screen opens, not after a delay. */
export function useStreakSound() {
  const { soundEnabled, soundVolume } = useAudioManager();
  return useCallback(() => {
    if (typeof window === "undefined") return;
    void streakHaptics();
    if (!soundEnabled || soundVolume <= 0) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    whenAudioReady(ctx, () => playStreakFanfare(ctx, soundVolume));
  }, [soundEnabled, soundVolume]);
}

/** A double tap of the phone in time with the burst and the tick. Native app only, and optional. */
async function streakHaptics() {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    window.setTimeout(() => void Haptics.impact({ style: ImpactStyle.Heavy }), 850);
    window.setTimeout(() => void Haptics.notification({ type: NotificationType.Success }), 1250);
  } catch {
    // Haptics are optional.
  }
}
