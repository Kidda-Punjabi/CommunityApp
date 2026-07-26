"use client";

import { Volume2 } from "lucide-react";
import { useRef } from "react";
import {
  applySpeechPlaybackRate,
  NORMAL_SPEECH_RATE,
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
  const { isSlow: isSlowAudio, setRate } = useSpeechPlaybackRate();

  function playAt(rate: number) {
    const audio = audioRef.current;
    if (!audio) return;
    setRate(rate);
    applySpeechPlaybackRate(audio, rate);
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
          onClick={() => playAt(NORMAL_SPEECH_RATE)}
          aria-label={label}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-600"
        >
          <Volume2 className={iconClass} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => playAt(SLOW_SPEECH_RATE)}
          aria-label="Play slowly"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[12px] leading-none ${
            isSlowAudio
              ? "border-violet-300 bg-violet-50 text-violet-700"
              : "border-zinc-200 bg-white text-zinc-500"
          }`}
          title={`Play slower (${SLOW_SPEECH_RATE.toFixed(1)}×)`}
        >
          🐢
        </button>
      </div>
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
    </>
  );
}
