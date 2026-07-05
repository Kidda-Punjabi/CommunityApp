"use client";

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

  const sizeClass =
    size === "sm"
      ? "rounded-full px-2.5 py-1 text-[11px]"
      : "rounded-full px-3 py-1.5 text-xs";

  return (
    <>
      <button
        type="button"
        onClick={handlePlay}
        aria-label={label}
        className={`shrink-0 border border-zinc-200 bg-white font-semibold text-zinc-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 ${sizeClass}`}
      >
        Play
      </button>
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
    </>
  );
}
