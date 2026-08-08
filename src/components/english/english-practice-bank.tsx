"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { EnglishBilingualToggle } from "@/components/english/english-bilingual-toggle";
import { EnglishExamQuestionImage } from "@/components/english/english-exam-question-image";
import { EnglishOptionSpeechMuteToggle } from "@/components/english/english-option-speech-mute-toggle";
import type { EnglishExamQuestion } from "@/lib/learning/english-exam-courses";
import {
  cancelOptionSelectionSpeech,
  useOptionSelectionSpeech,
} from "@/lib/audio/option-selection-speech";
import {
  applySpeechPlaybackRate,
  useSpeechPlaybackRate,
} from "@/lib/audio/speech-playback";
import { cn } from "@/lib/ui/styles";

type EnglishPracticeBankProps = {
  courseName: string;
  courseId: string;
  questions: EnglishExamQuestion[];
};

type LangKey = "punjabi" | "english";

function playAudioUrl(url: string, audio: HTMLAudioElement) {
  return new Promise<void>((resolve, reject) => {
    audio.src = url;
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Playback failed"));
    void audio.play().catch(reject);
  });
}

export function EnglishPracticeBank({
  courseName,
  courseId,
  questions,
}: EnglishPracticeBankProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showEnglish, setShowEnglish] = useState(true);
  const [playingLang, setPlayingLang] = useState<LangKey | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { rate: speechRate } = useSpeechPlaybackRate();
  const { muted: optionSpeechMuted, setMuted: setOptionSpeechMuted, speakOption } =
    useOptionSelectionSpeech();

  const question = questions[index];
  const total = questions.length;

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cancelOptionSelectionSpeech();
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    applySpeechPlaybackRate(audioRef.current, speechRate);
  }, [speechRate]);

  // Stop clip when moving between questions.
  useEffect(() => {
    audioRef.current?.pause();
    setPlayingLang(null);
    cancelOptionSelectionSpeech();
  }, [index]);

  const optionLabels = useMemo(() => {
    if (!question) return [];
    return [
      { key: "a" as const, label: question.optionA },
      { key: "b" as const, label: question.optionB },
      { key: "c" as const, label: question.optionC },
      { key: "d" as const, label: question.optionD },
    ].filter((opt) => opt.label?.trim());
  }, [question]);

  const handlePlay = useCallback(
    async (lang: LangKey) => {
      if (!question) return;
      const url =
        lang === "punjabi"
          ? question.questionAudioPaUrl?.trim()
          : question.questionAudioEnUrl?.trim();
      if (!url) {
        setAudioNotice("Audio not ready yet");
        window.setTimeout(() => setAudioNotice(null), 2200);
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;
      cancelOptionSelectionSpeech();
      applySpeechPlaybackRate(audio, speechRate);
      setPlayingLang(lang);
      setAudioNotice(null);

      try {
        await playAudioUrl(url, audio);
      } catch {
        setAudioNotice("Couldn’t play this clip");
        window.setTimeout(() => setAudioNotice(null), 2200);
      } finally {
        setPlayingLang((current) => (current === lang ? null : current));
      }
    },
    [question, speechRate]
  );

  if (!question || total === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No practice questions are available for this course yet.
      </p>
    );
  }

  const isCorrect = selected === question.correctAnswer;
  const promptPa = question.questionTextPa?.trim();
  const explainPa = question.explanationPa?.trim();
  const explainEn = question.explanation?.trim();
  const showPaPlay = Boolean(promptPa || question.questionAudioPaUrl);
  const showEnPlay = showEnglish;

  function choose(key: string) {
    if (revealed) return;
    setSelected(key);
    const label = optionLabels.find((opt) => opt.key === key)?.label?.trim();
    if (label) {
      audioRef.current?.pause();
      setPlayingLang(null);
      speakOption(label);
    }
  }

  function check() {
    if (!selected) return;
    setRevealed(true);
  }

  function goNext() {
    if (index >= total - 1) return;
    setIndex((value) => value + 1);
    setSelected(null);
    setRevealed(false);
  }

  function goPrev() {
    if (index <= 0) return;
    setIndex((value) => value - 1);
    setSelected(null);
    setRevealed(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Practice bank
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Untimed · {total} questions · {courseName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnglishOptionSpeechMuteToggle
            muted={optionSpeechMuted}
            onChange={setOptionSpeechMuted}
          />
          <EnglishBilingualToggle showEnglish={showEnglish} onChange={setShowEnglish} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
        <span>
          Question {index + 1} of {total}
        </span>
        <Link
          href={`/dashboard/english/learn/${courseId}`}
          className="text-emerald-700 hover:text-emerald-600"
        >
          Back to course
        </Link>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-5">
        <EnglishExamQuestionImage
          imageUrl={question.imageUrl}
          attribution={question.imageAttribution}
        />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {promptPa ? (
              <p className="text-base font-medium leading-snug text-zinc-900">
                {promptPa}
              </p>
            ) : null}
            {showEnglish ? (
              <p
                className={cn(
                  "text-sm leading-snug text-zinc-600",
                  promptPa ? "" : "text-base font-medium text-zinc-900"
                )}
              >
                {question.questionText}
              </p>
            ) : null}
            {!promptPa && !showEnglish ? (
              <p className="text-base font-medium text-zinc-900">
                {question.questionText}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {showPaPlay ? (
              <button
                type="button"
                aria-label="Play Punjabi question"
                title="Play Punjabi"
                onClick={() => void handlePlay("punjabi")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors",
                  playingLang === "punjabi"
                    ? "bg-emerald-700"
                    : "bg-emerald-600 hover:bg-emerald-500"
                )}
              >
                {playingLang === "punjabi" ? (
                  <Pause className="h-3.5 w-3.5" fill="currentColor" />
                ) : (
                  <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                )}
              </button>
            ) : null}
            {showEnPlay ? (
              <button
                type="button"
                aria-label="Play English question"
                title="Play English"
                onClick={() => void handlePlay("english")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                  playingLang === "english"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                )}
              >
                {playingLang === "english" ? (
                  <Pause className="h-3.5 w-3.5" fill="currentColor" />
                ) : (
                  <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                )}
              </button>
            ) : null}
          </div>
        </div>

        {audioNotice ? (
          <p className="mt-2 text-xs font-medium text-amber-700">{audioNotice}</p>
        ) : null}

        <div className="mt-4 space-y-2">
          {optionLabels.map((opt) => {
            const chosen = selected === opt.key;
            const showResult = revealed && chosen;
            const isAnswer = revealed && opt.key === question.correctAnswer;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => choose(opt.key)}
                disabled={revealed}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                  isAnswer
                    ? "border-emerald-400 bg-emerald-50 text-emerald-950"
                    : showResult && !isCorrect
                      ? "border-red-300 bg-red-50 text-red-950"
                      : chosen
                        ? "border-zinc-400 bg-zinc-100 text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase",
                    chosen && !revealed
                      ? "bg-zinc-200 text-zinc-700"
                      : "bg-zinc-100 text-zinc-600"
                  )}
                >
                  {opt.key}
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {!revealed ? (
          <button
            type="button"
            onClick={check}
            disabled={!selected}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Check answer
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p
              className={cn(
                "text-sm font-semibold",
                isCorrect ? "text-emerald-700" : "text-red-700"
              )}
            >
              {isCorrect ? "Correct" : "Not quite"}
              {!isCorrect
                ? ` — answer ${question.correctAnswer.toUpperCase()}`
                : ""}
            </p>
            {(explainPa || explainEn) && (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                {explainPa ? <p>{explainPa}</p> : null}
                {showEnglish && explainEn ? (
                  <p className={cn(explainPa ? "mt-1.5 text-zinc-600" : "")}>
                    {explainEn}
                  </p>
                ) : null}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={index === 0}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={index >= total - 1}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                {index >= total - 1 ? "Done" : "Next"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
