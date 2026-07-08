"use client";

import { Volume2 } from "lucide-react";
import { useRef } from "react";
import {
  applySpeechPlaybackRate,
  SLOW_SPEECH_RATE,
  useSpeechPlaybackRate,
} from "@/lib/audio/speech-playback";

type DictionaryAudioPlayButtonProps = {
  audioUrl: string;
  label: string;
  size?: "sm" | "md";
};

export function DictionaryAudioPlayButton({
  audioUrl,
  label,
  size = "md",
}: DictionaryAudioPlayButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { rate: speechRate, isSlow: isSlowAudio, toggleSlow: toggleSlowAudio } =
    useSpeechPlaybackRate();

  function handlePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    applySpeechPlaybackRate(audio, speechRate);
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay policies may block without prior gesture — user tapped Play.
    });
  }

  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handlePlay}
          aria-label={label}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-600"
        >
          <Volume2 className={iconClass} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleSlowAudio}
          aria-label={`Toggle slow audio (${isSlowAudio ? "on" : "off"})`}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[12px] leading-none ${
            isSlowAudio
              ? "border-violet-300 bg-violet-50 text-violet-700"
              : "border-zinc-200 bg-white text-zinc-500"
          }`}
          title={isSlowAudio ? `Slow audio on (${SLOW_SPEECH_RATE.toFixed(1)}x)` : "Use slower audio"}
        >
          🐢
        </button>
      </div>
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
    </>
  );
}
