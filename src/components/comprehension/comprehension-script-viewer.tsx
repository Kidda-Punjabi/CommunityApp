"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMPREHENSION_MODE_LABELS,
  PLAY_ALL_PAUSE_MS,
  type ComprehensionMode,
} from "@/lib/comprehension/config";
import type { ComprehensionSentence, ComprehensionViewerPreferences } from "@/lib/comprehension/types";

type ComprehensionScriptViewerProps = {
  title: string;
  sentences: ComprehensionSentence[];
  mode: ComprehensionMode;
  preferences: ComprehensionViewerPreferences;
  onPreferencesChange: (next: ComprehensionViewerPreferences) => void;
  emphasizeAudio?: boolean;
  className?: string;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function playAudioUrl(url: string, audio: HTMLAudioElement) {
  return new Promise<void>((resolve, reject) => {
    audio.src = url;
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Playback failed"));
    void audio.play().catch(reject);
  });
}

export function ComprehensionScriptViewer({
  title,
  sentences,
  mode,
  preferences,
  onPreferencesChange,
  emphasizeAudio = false,
  className = "",
}: ComprehensionScriptViewerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playAllAbortRef = useRef(false);
  const [playingAll, setPlayingAll] = useState(false);
  const [playingSentenceId, setPlayingSentenceId] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      playAllAbortRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const setShowGurmukhi = useCallback(
    (showGurmukhi: boolean) => {
      onPreferencesChange({ ...preferences, showGurmukhi });
    },
    [onPreferencesChange, preferences]
  );

  const setShowRomanised = useCallback(
    (showRomanised: boolean) => {
      onPreferencesChange({ ...preferences, showRomanised });
    },
    [onPreferencesChange, preferences]
  );

  const revealScript = useCallback(() => {
    onPreferencesChange({ showGurmukhi: true, showRomanised: true });
  }, [onPreferencesChange]);

  const handlePlaySentence = useCallback(async (sentence: ComprehensionSentence) => {
    if (!sentence.audio_url?.trim()) {
      setAudioNotice("Recording yet to be published");
      window.setTimeout(() => setAudioNotice(null), 2200);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    playAllAbortRef.current = true;
    setPlayingAll(false);
    setPlayingSentenceId(sentence.id);
    setAudioNotice(null);

    try {
      await playAudioUrl(sentence.audio_url, audio);
    } catch {
      setAudioNotice("Recording yet to be published");
      window.setTimeout(() => setAudioNotice(null), 2200);
    } finally {
      setPlayingSentenceId(null);
    }
  }, []);

  const handlePlayAll = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || sentences.length === 0) return;

    playAllAbortRef.current = false;
    setPlayingAll(true);
    setAudioNotice(null);

    for (const sentence of sentences) {
      if (playAllAbortRef.current) break;

      if (!sentence.audio_url?.trim()) {
        continue;
      }

      setPlayingSentenceId(sentence.id);
      try {
        await playAudioUrl(sentence.audio_url, audio);
      } catch {
        // Skip broken clips during play-all
      }
      setPlayingSentenceId(null);

      if (playAllAbortRef.current) break;
      await sleep(PLAY_ALL_PAUSE_MS);
    }

    setPlayingAll(false);
  }, [sentences]);

  const textHidden = !preferences.showGurmukhi && !preferences.showRomanised;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {COMPREHENSION_MODE_LABELS[mode]} mode
          </p>
          <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowGurmukhi(!preferences.showGurmukhi)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              preferences.showGurmukhi
                ? "bg-violet-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Gurmukhi
          </button>
          <button
            type="button"
            onClick={() => setShowRomanised(!preferences.showRomanised)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              preferences.showRomanised
                ? "bg-violet-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Romanised
          </button>
        </div>
      </div>

      {mode === "listening" && textHidden ? (
        <button
          type="button"
          onClick={revealScript}
          className="w-full rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 hover:bg-violet-100"
        >
          Reveal script
        </button>
      ) : null}

      {emphasizeAudio || mode !== "reading" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handlePlayAll()}
            disabled={playingAll || sentences.length === 0}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:bg-zinc-300"
          >
            {playingAll ? "Playing…" : "Play all"}
          </button>
          {audioNotice ? (
            <p className="text-sm text-amber-800">{audioNotice}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {sentences.map((sentence) => (
          <div
            key={sentence.id}
            className={`rounded-xl border px-4 py-3 ${
              playingSentenceId === sentence.id
                ? "border-violet-400 bg-violet-50"
                : "border-zinc-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                {preferences.showGurmukhi ? (
                  <p className="text-base font-semibold leading-relaxed text-zinc-900">
                    {sentence.gurmukhi_text}
                  </p>
                ) : null}
                {preferences.showRomanised ? (
                  <p className="text-sm leading-relaxed text-violet-600">
                    {sentence.romanised_text}
                  </p>
                ) : null}
                {sentence.english_translation &&
                (preferences.showGurmukhi || preferences.showRomanised) ? (
                  <p className="text-sm text-zinc-500">{sentence.english_translation}</p>
                ) : null}
                {textHidden ? (
                  <p className="text-sm italic text-zinc-400">Text hidden — tap Reveal script</p>
                ) : null}
              </div>
              {(emphasizeAudio || mode !== "reading") && (
                <button
                  type="button"
                  onClick={() => void handlePlaySentence(sentence)}
                  disabled={playingAll}
                  className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:border-violet-300 disabled:opacity-50"
                  aria-label={`Play sentence ${sentence.sequence_order}`}
                >
                  ▶
                </button>
              )}
            </div>
          </div>
        ))}
        {sentences.length === 0 ? (
          <p className="text-sm text-zinc-500">This script has no sentences yet.</p>
        ) : null}
      </div>
    </div>
  );
}
