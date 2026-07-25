"use client";

import { Volume2 } from "lucide-react";
import { useRef } from "react";
import {
  applySpeechPlaybackRate,
  NORMAL_SPEECH_RATE,
  SLOW_SPEECH_RATE,
} from "@/lib/audio/speech-playback";

type TopicListenButtonProps = {
  audioUrl: string;
  label?: string;
  className?: string;
};

/** Subtle speaker + slow-play controls for Everyday Punjabi practice audio. */
export function TopicListenButton({
  audioUrl,
  label = "Listen",
  className = "",
}: TopicListenButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function playAt(rate: number) {
    const audio = audioRef.current;
    if (!audio) return;
    applySpeechPlaybackRate(audio, rate);
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Gesture already happened — ignore autoplay rejection.
    });
  }

  function handlePlay(event: React.MouseEvent) {
    event.stopPropagation();
    playAt(NORMAL_SPEECH_RATE);
  }

  function handleSlowPlay(event: React.MouseEvent) {
    event.stopPropagation();
    playAt(SLOW_SPEECH_RATE);
  }

  return (
    <>
      <span className={`inline-flex items-center gap-0.5 ${className}`}>
        <button
          type="button"
          onClick={handlePlay}
          aria-label={label}
          title={label}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-violet-600"
        >
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleSlowPlay}
          aria-label={`${label} slowly`}
          title={`Play slowly (${SLOW_SPEECH_RATE.toFixed(1)}x)`}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-wide text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
        >
          Slow
        </button>
      </span>
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
    </>
  );
}
