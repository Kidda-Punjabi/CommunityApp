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

let activeClip: HTMLAudioElement | null = null;

function playExclusiveClip(audio: HTMLAudioElement) {
  if (activeClip && activeClip !== audio) {
    activeClip.pause();
    try {
      activeClip.currentTime = 0;
    } catch {
      // Ignore elements that are not seekable yet.
    }
  }
  activeClip = audio;
  audio.currentTime = 0;
  void audio.play().catch(() => {
    if (activeClip === audio) activeClip = null;
  });
}

/** Compact play control for approved flashcard TTS (same assets as Dictionary). */
export function FlashcardAudioPlayButton({
  audioUrl,
  label,
  className = "",
}: FlashcardAudioPlayButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { rate: speechRate } = useSpeechPlaybackRate();

  function handlePlay(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    applySpeechPlaybackRate(audio, speechRate);
    playExclusiveClip(audio);
  }

  return (
    <>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
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
