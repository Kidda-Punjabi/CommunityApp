import type { SoundName } from "./sound-types";

type ToneStep = {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
};

const SOUND_PRESETS: Record<SoundName, ToneStep[]> = {
  correct: [
    { frequency: 523.25, duration: 0.08, type: "sine", gain: 0.35 },
    { frequency: 659.25, duration: 0.12, type: "sine", gain: 0.3, delay: 0.06 },
  ],
  incorrect: [
    { frequency: 180, duration: 0.14, type: "triangle", gain: 0.22 },
    { frequency: 140, duration: 0.16, type: "triangle", gain: 0.16, delay: 0.1 },
  ],
  button_tap: [{ frequency: 420, duration: 0.03, type: "sine", gain: 0.12 }],
  game_complete: [
    { frequency: 392, duration: 0.1, type: "sine", gain: 0.28 },
    { frequency: 523.25, duration: 0.1, type: "sine", gain: 0.26, delay: 0.08 },
    { frequency: 659.25, duration: 0.18, type: "sine", gain: 0.24, delay: 0.16 },
  ],
  level_up: [
    { frequency: 440, duration: 0.1, type: "sine", gain: 0.3 },
    { frequency: 554.37, duration: 0.1, type: "sine", gain: 0.28, delay: 0.09 },
    { frequency: 659.25, duration: 0.1, type: "sine", gain: 0.26, delay: 0.18 },
    { frequency: 880, duration: 0.22, type: "sine", gain: 0.22, delay: 0.27 },
  ],
  xp_milestone: [
    { frequency: 587.33, duration: 0.09, type: "sine", gain: 0.24 },
    { frequency: 739.99, duration: 0.14, type: "sine", gain: 0.2, delay: 0.07 },
  ],
  sticker_earned: [
    { frequency: 523.25, duration: 0.07, type: "triangle", gain: 0.26 },
    { frequency: 659.25, duration: 0.07, type: "triangle", gain: 0.24, delay: 0.06 },
    { frequency: 783.99, duration: 0.07, type: "triangle", gain: 0.22, delay: 0.12 },
    { frequency: 987.77, duration: 0.16, type: "triangle", gain: 0.2, delay: 0.18 },
  ],
};

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    sharedContext = new Ctx();
  }
  return sharedContext;
}

export function playSynthesizedSound(name: SoundName, volume: number): void {
  const ctx = getAudioContext();
  if (!ctx || volume <= 0) return;

  void ctx.resume().catch(() => undefined);

  const now = ctx.currentTime;
  const steps = SOUND_PRESETS[name];

  for (const step of steps) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const start = now + (step.delay ?? 0);
    const peakGain = (step.gain ?? 0.25) * volume;

    oscillator.type = step.type ?? "sine";
    oscillator.frequency.setValueAtTime(step.frequency, start);
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(peakGain, 0.0001), start + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + step.duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + step.duration + 0.02);
  }
}

export function warmUpAudioContext(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);
}
