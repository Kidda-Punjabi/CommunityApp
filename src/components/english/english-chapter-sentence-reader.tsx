"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { EnglishLessonSentence } from "@/lib/learning/english-exam-courses";
import {
  applySpeechPlaybackRate,
  useSpeechPlaybackRate,
} from "@/lib/audio/speech-playback";
import { cn } from "@/lib/ui/styles";

const PLAY_ALL_PAUSE_MS = 350;

type EnglishChapterSentenceReaderProps = {
  title: string;
  sentences: EnglishLessonSentence[];
};

type LangKey = "punjabi" | "english";

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

function audioUrlFor(
  sentence: EnglishLessonSentence,
  lang: LangKey
): string | null {
  if (lang === "punjabi") {
    return sentence.punjabiAudioUrl?.trim() || null;
  }
  return sentence.englishAudioUrl?.trim() || null;
}

export function EnglishChapterSentenceReader({
  title,
  sentences,
}: EnglishChapterSentenceReaderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playAllAbortRef = useRef(false);
  const [showPunjabi, setShowPunjabi] = useState(true);
  const [showRomanised, setShowRomanised] = useState(true);
  const [showEnglish, setShowEnglish] = useState(true);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [playingAll, setPlayingAll] = useState<LangKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { rate: speechRate } = useSpeechPlaybackRate();

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

  useEffect(() => {
    if (!audioRef.current) return;
    applySpeechPlaybackRate(audioRef.current, speechRate);
  }, [speechRate]);

  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
  }, []);

  const stopPlayback = useCallback(() => {
    playAllAbortRef.current = true;
    setPlayingAll(null);
    setPlayingKey(null);
    audioRef.current?.pause();
  }, []);

  const handlePlaySentence = useCallback(
    async (sentence: EnglishLessonSentence, lang: LangKey) => {
      const url = audioUrlFor(sentence, lang);
      if (!url) {
        flashNotice("Audio not ready yet");
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;
      applySpeechPlaybackRate(audio, speechRate);

      playAllAbortRef.current = true;
      setPlayingAll(null);
      const key = `${sentence.id}:${lang}`;
      setPlayingKey(key);

      try {
        await playAudioUrl(url, audio);
      } catch {
        flashNotice("Couldn’t play this clip");
      } finally {
        setPlayingKey((current) => (current === key ? null : current));
      }
    },
    [flashNotice, speechRate]
  );

  const handlePlayAll = useCallback(
    async (lang: LangKey) => {
      const audio = audioRef.current;
      if (!audio || sentences.length === 0) return;
      applySpeechPlaybackRate(audio, speechRate);

      playAllAbortRef.current = false;
      setPlayingAll(lang);
      setNotice(null);

      for (const sentence of sentences) {
        if (playAllAbortRef.current) break;
        const url = audioUrlFor(sentence, lang);
        if (!url) continue;

        const key = `${sentence.id}:${lang}`;
        setPlayingKey(key);
        try {
          await playAudioUrl(url, audio);
        } catch {
          // skip broken clip
        }
        setPlayingKey(null);
        if (playAllAbortRef.current) break;
        await sleep(PLAY_ALL_PAUSE_MS);
      }

      setPlayingAll(null);
    },
    [sentences, speechRate]
  );

  const anyTextVisible = showPunjabi || showRomanised || showEnglish;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          Chapter reader
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          {title}
        </h1>
      </div>

      <div className="flex flex-wrap gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            checked={showPunjabi}
            onChange={(event) => setShowPunjabi(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          Punjabi
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            checked={showRomanised}
            onChange={(event) => setShowRomanised(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          Romanised
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            checked={showEnglish}
            onChange={(event) => setShowEnglish(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          English
        </label>
      </div>

      {!anyTextVisible ? (
        <p className="text-sm text-amber-800">
          Turn on at least one language to see the sentences.
        </p>
      ) : null}

      <ul className="space-y-3">
        {sentences.map((sentence) => {
          const paPlaying = playingKey === `${sentence.id}:punjabi`;
          const enPlaying = playingKey === `${sentence.id}:english`;
          return (
            <li
              key={sentence.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl border bg-white px-4 py-3",
                paPlaying || enPlaying
                  ? "border-emerald-400 shadow-sm"
                  : "border-zinc-200"
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                {showPunjabi && sentence.punjabiText ? (
                  <p className="text-[15px] leading-relaxed text-zinc-900">
                    {sentence.punjabiText}
                  </p>
                ) : null}
                {showRomanised && sentence.romanisedText ? (
                  <p className="text-sm italic leading-relaxed text-zinc-500">
                    {sentence.romanisedText}
                  </p>
                ) : null}
                {showEnglish && sentence.englishText ? (
                  <p className="text-sm leading-relaxed text-zinc-700">
                    {sentence.englishText}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                <button
                  type="button"
                  aria-label="Play Punjabi"
                  title="Play Punjabi"
                  onClick={() => void handlePlaySentence(sentence, "punjabi")}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors",
                    paPlaying
                      ? "bg-emerald-700"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  )}
                >
                  {paPlaying ? (
                    <Pause className="h-3.5 w-3.5" fill="currentColor" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Play English"
                  title="Play English"
                  onClick={() => void handlePlaySentence(sentence, "english")}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                    enPlaying
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  )}
                >
                  {enPlaying ? (
                    <Pause className="h-3.5 w-3.5" fill="currentColor" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() =>
            playingAll === "punjabi"
              ? stopPlayback()
              : void handlePlayAll("punjabi")
          }
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {playingAll === "punjabi" ? "Stop" : "Play in Punjabi"}
        </button>
        <button
          type="button"
          onClick={() =>
            playingAll === "english"
              ? stopPlayback()
              : void handlePlayAll("english")
          }
          className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-emerald-600 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          {playingAll === "english" ? "Stop" : "Play in English"}
        </button>
      </div>

      {notice ? (
        <p className="text-center text-xs font-medium text-amber-700">{notice}</p>
      ) : null}
    </div>
  );
}
