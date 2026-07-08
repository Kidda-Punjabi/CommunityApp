"use client";

import { useCallback, useEffect, useState } from "react";

export const NORMAL_SPEECH_RATE = 1;
export const SLOW_SPEECH_RATE = 0.8;
const STORAGE_KEY = "kidda:speech-playback-rate";

function sanitizeRate(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return NORMAL_SPEECH_RATE;
  if (Math.abs(value - 0.85) < 0.001) return SLOW_SPEECH_RATE;
  return Math.abs(value - SLOW_SPEECH_RATE) < 0.001 ? SLOW_SPEECH_RATE : NORMAL_SPEECH_RATE;
}

export function applySpeechPlaybackRate(audio: HTMLAudioElement, rate: number): void {
  const nextRate = sanitizeRate(rate);
  audio.playbackRate = nextRate;
  // Preserve pitch while slowing down speech where supported.
  (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  (audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
  (audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
}

function readStoredSpeechRate(): number {
  if (typeof window === "undefined") return NORMAL_SPEECH_RATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return sanitizeRate(raw ? Number(raw) : NORMAL_SPEECH_RATE);
  } catch {
    return NORMAL_SPEECH_RATE;
  }
}

function storeSpeechRate(rate: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(sanitizeRate(rate)));
  } catch {
    // Ignore private mode / quota issues.
  }
}

export function useSpeechPlaybackRate() {
  const [rate, setRate] = useState<number>(NORMAL_SPEECH_RATE);

  useEffect(() => {
    setRate(readStoredSpeechRate());
  }, []);

  const setAndStoreRate = useCallback((nextRate: number) => {
    const sanitized = sanitizeRate(nextRate);
    setRate(sanitized);
    storeSpeechRate(sanitized);
  }, []);

  const toggleSlow = useCallback(() => {
    setAndStoreRate(rate === SLOW_SPEECH_RATE ? NORMAL_SPEECH_RATE : SLOW_SPEECH_RATE);
  }, [rate, setAndStoreRate]);

  return {
    rate,
    isSlow: rate === SLOW_SPEECH_RATE,
    setRate: setAndStoreRate,
    toggleSlow,
  };
}
