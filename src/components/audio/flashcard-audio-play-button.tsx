"use client";

import { Volume2 } from "lucide-react";
import { useRef } from "react";
import {
  applySpeechPlaybackRate,
  useSpeechPlaybackRate,
} from "@/lib/audio/speech-playback";

type FlashcardAudioPlayButtonProps = {
  audioUrl: string;
  label: string;
  className?: string;
};

/** Compact play control for approved flashcard TTS (same assets as Dictionary). */
export function FlashcardAudioPlayButton({
  audioUrl,
  label,
  className = "",
}: FlashcardAudioPlayButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { rate: speechRate } = useSpeechPlaybackRate();

  function handlePlay(event: React.MouseEvent) {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    applySpeechPlaybackRate(audio, speechRate);
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Gesture already happened — ignore autoplay rejection.
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePlay}
        aria-label={label}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-600 ${className}`}
      >
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
    </>
  );
}
