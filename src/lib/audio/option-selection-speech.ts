"use client";

import { useCallback, useEffect, useState } from "react";

const MUTE_STORAGE_KEY = "kidda:english-exam-option-speech-muted";

function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function storeMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore private mode / quota issues.
  }
}

/** Cancel any in-flight browser TTS utterance. */
export function cancelOptionSelectionSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const prefer = [
    /en-GB/i,
    /british/i,
    /daniel/i,
    /google uk/i,
    /siri.*en-GB/i,
  ];
  for (const pattern of prefer) {
    const hit = voices.find(
      (voice) =>
        pattern.test(voice.lang) ||
        pattern.test(voice.name) ||
        pattern.test(voice.voiceURI)
    );
    if (hit) return hit;
  }
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ?? null
  );
}

/**
 * Read English option text aloud via Web Speech API (en-GB).
 * No-op when unsupported or text is empty.
 */
export function speakEnglishOptionText(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const trimmed = text.trim();
  if (!trimmed) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = "en-GB";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  const voice = pickEnglishVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

/**
 * Session-persisted mute for on-select option readout.
 * Default: unmuted (speech on).
 */
export function useOptionSelectionSpeech() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(readMuted());
    return () => cancelOptionSelectionSpeech();
  }, []);

  const setMuted = useCallback((next: boolean) => {
    setMutedState(next);
    storeMuted(next);
    if (next) cancelOptionSelectionSpeech();
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted(!muted);
  }, [muted, setMuted]);

  const speakOption = useCallback(
    (text: string) => {
      if (muted) return;
      speakEnglishOptionText(text);
    },
    [muted]
  );

  return { muted, setMuted, toggleMuted, speakOption };
}
