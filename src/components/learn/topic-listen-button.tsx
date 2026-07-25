"use client";

import { Volume2 } from "lucide-react";
import { useRef } from "react";
import {
  applySpeechPlaybackRate,
  useSpeechPlaybackRate,
} from "@/lib/audio/speech-playback";

type TopicListenButtonProps = {
  audioUrl: string;
  label?: string;
  className?: string;
};

/** Subtle speaker icon for Everyday Punjabi practice audio. */
export function TopicListenButton({
  audioUrl,
  label = "Listen",
  className = "",
}: TopicListenButtonProps) {
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
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-violet-600 ${className}`}
      >
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
    </>
  );
}
