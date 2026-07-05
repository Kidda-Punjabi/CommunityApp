"use client";

import { useEffect, useRef } from "react";
import type { CatchupBeat } from "@/lib/catchup/types";
import { formatPunjabiForDisplay } from "@/lib/conjugation/format";

type CatchupBeatRowProps = {
  beat: CatchupBeat;
  isActive: boolean;
  onPlay: () => void;
  onEnded: () => void;
};

export function CatchupBeatRow({ beat, isActive, onPlay, onEnded }: CatchupBeatRowProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isActive || beat.audioUrl) return;
    const timer = window.setTimeout(() => onEnded(), 0);
    return () => window.clearTimeout(timer);
  }, [isActive, beat.audioUrl, onEnded]);

  useEffect(() => {
    if (!isActive || !beat.audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play().catch(() => {
      // Autoplay may be blocked until user gesture — manual play still works.
    });
  }, [isActive, beat.audioUrl]);

  const displayText =
    beat.beatType === "narration"
      ? beat.scriptText
      : beat.phraseLabel
        ? formatPunjabiForDisplay(beat.phraseLabel)
        : null;

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        isActive
          ? "border-violet-300 bg-violet-50 shadow-sm"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {beat.beatType === "narration" ? "Narration" : "Phrase"}
          </p>
          {displayText ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
              {displayText}
            </p>
          ) : null}
          {beat.beatType === "phrase_reference" && beat.phraseTranslation ? (
            <p className="mt-2 text-sm text-zinc-500">{beat.phraseTranslation}</p>
          ) : null}
          {beat.audioStatus !== "approved" && beat.beatType === "phrase_reference" ? (
            <p className="mt-2 text-xs text-amber-700">
              Phrase audio is not approved yet — read the text above for now.
            </p>
          ) : null}
        </div>
        {beat.audioUrl ? (
          <button
            type="button"
            onClick={onPlay}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${
              isActive
                ? "bg-violet-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {isActive ? "Playing" : "Play"}
          </button>
        ) : beat.beatType === "narration" ? (
          <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">
            Audio pending
          </span>
        ) : null}
      </div>

      {beat.audioUrl ? (
        <audio
          ref={audioRef}
          src={beat.audioUrl}
          preload="metadata"
          onEnded={onEnded}
          className="hidden"
        />
      ) : null}
    </div>
  );
}
