"use client";

import { Volume2 } from "lucide-react";
import { useRef } from "react";

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

  function handlePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay policies may block without prior gesture — user tapped Play.
    });
  }

  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <>
      <button
        type="button"
        onClick={handlePlay}
        aria-label={label}
        className="shrink-0 text-zinc-500 transition-colors hover:text-violet-600"
      >
        <Volume2 className={iconClass} aria-hidden="true" />
      </button>
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
    </>
  );
}
