"use client";

import { Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  applySpeechPlaybackRate,
  useSpeechPlaybackRate,
} from "@/lib/audio/speech-playback";

type TopicListenButtonProps = {
  audioUrl: string;
  label?: string;
  className?: string;
};

/** Labeled Listen control for Everyday Punjabi practice. */
export function TopicListenButton({
  audioUrl,
  label = "Listen",
  className = "",
}: TopicListenButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { rate: speechRate } = useSpeechPlaybackRate();
  const [playing, setPlaying] = useState(false);

  function handlePlay(event: React.MouseEvent) {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    applySpeechPlaybackRate(audio, speechRate);
    audio.currentTime = 0;
    setPlaying(true);
    void audio.play().catch(() => {
      setPlaying(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePlay}
        aria-label={label}
        className={`inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-700 ${className}`}
      >
        <Volume2 className="h-4 w-4" aria-hidden="true" />
        {playing ? "Playing…" : label}
      </button>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
    </>
  );
}
