"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { EnglishBilingualToggle } from "@/components/english/english-bilingual-toggle";
import { EnglishExamQuestionImage } from "@/components/english/english-exam-question-image";
import { EnglishOptionSpeechMuteToggle } from "@/components/english/english-option-speech-mute-toggle";
import type { EnglishExamQuestion } from "@/lib/learning/english-exam-courses";
import {
  PRACTICE_SESSION_SIZE,
  buildPracticeSession,
  isPracticeStruggle,
  listStruggleQuestions,
  readPracticeOrderPreference,
  readPracticeStruggles,
  recordPracticeAttempt,
  storePracticeOrderPreference,
  storePracticeStruggles,
  type PracticeDrawMode,
  type PracticeOrderMode,
  type PracticeStruggleMap,
} from "@/lib/learning/english-practice-session";
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

type Phase = "setup" | "session" | "results";
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
  questions: bank,
}: EnglishPracticeBankProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [orderMode, setOrderMode] = useState<PracticeOrderMode>("sequential");
  const [struggles, setStruggles] = useState<PracticeStruggleMap>({});
  const [session, setSession] = useState<EnglishExamQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [sessionMissIds, setSessionMissIds] = useState<string[]>([]);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [showEnglish, setShowEnglish] = useState(true);
  const [playingLang, setPlayingLang] = useState<LangKey | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scoredIdsRef = useRef<Set<string>>(new Set());
  const { rate: speechRate } = useSpeechPlaybackRate();
  const { muted: optionSpeechMuted, setMuted: setOptionSpeechMuted, speakOption } =
    useOptionSelectionSpeech();

  const question = session[index];
  const total = session.length;
  const struggleCount = useMemo(
    () => listStruggleQuestions(bank, struggles).length,
    [bank, struggles]
  );

  useEffect(() => {
    setOrderMode(readPracticeOrderPreference());
    setStruggles(readPracticeStruggles(courseId));
  }, [courseId]);

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

  useEffect(() => {
    audioRef.current?.pause();
    setPlayingLang(null);
    cancelOptionSelectionSpeech();
  }, [index, phase]);

  const optionLabels = useMemo(() => {
    if (!question) return [];
    return [
      {
        key: "a" as const,
        labelEn: question.optionA,
        labelPa: question.optionAPa,
      },
      {
        key: "b" as const,
        labelEn: question.optionB,
        labelPa: question.optionBPa,
      },
      {
        key: "c" as const,
        labelEn: question.optionC,
        labelPa: question.optionCPa,
      },
      {
        key: "d" as const,
        labelEn: question.optionD,
        labelPa: question.optionDPa,
      },
    ].filter((opt) => opt.labelEn?.trim() || opt.labelPa?.trim());
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

  function chooseOrder(mode: PracticeOrderMode) {
    setOrderMode(mode);
    storePracticeOrderPreference(mode);
  }

  function startSession(draw: PracticeDrawMode) {
    const next = buildPracticeSession(bank, struggles, {
      order: orderMode,
      draw,
    });
    if (next.length === 0) return;
    scoredIdsRef.current = new Set();
    setSession(next);
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setSessionMissIds([]);
    setSessionCorrect(0);
    setPhase("session");
  }

  function choose(key: string) {
    if (revealed || !question) return;
    setSelected(key);
    const opt = optionLabels.find((item) => item.key === key);
    const labelEn = opt?.labelEn?.trim() || "";
    if (labelEn) {
      audioRef.current?.pause();
      setPlayingLang(null);
      speakOption(labelEn);
    }
  }

  function check() {
    if (!selected || !question) return;
    setRevealed(true);

    if (scoredIdsRef.current.has(question.id)) return;
    scoredIdsRef.current.add(question.id);

    const correct = selected === question.correctAnswer;
    setStruggles((prev) => {
      const next = recordPracticeAttempt(prev, question.id, correct);
      storePracticeStruggles(courseId, next);
      return next;
    });
    if (correct) {
      setSessionCorrect((value) => value + 1);
    } else {
      setSessionMissIds((prev) =>
        prev.includes(question.id) ? prev : [...prev, question.id]
      );
    }
  }

  function goNext() {
    if (index >= total - 1) {
      setPhase("results");
      return;
    }
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

  if (bank.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No practice questions are available for this course yet.
      </p>
    );
  }

  if (phase === "setup") {
    const sessionSize = Math.min(PRACTICE_SESSION_SIZE, bank.length);
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Practice bank
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
              {courseName}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Short rounds of {sessionSize} questions. We’ll remember the ones
              you miss and bring them back.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EnglishOptionSpeechMuteToggle
              muted={optionSpeechMuted}
              onChange={setOptionSpeechMuted}
            />
            <EnglishBilingualToggle
              showEnglish={showEnglish}
              onChange={setShowEnglish}
            />
          </div>
        </div>

        <ul className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 text-sm text-emerald-950">
          <li>
            <span className="font-semibold">{bank.length}</span> questions in the
            bank
          </li>
          <li>
            <span className="font-semibold">{sessionSize}</span> questions per
            round
          </li>
          <li>
            Struggle list:{" "}
            <span className="font-semibold">{struggleCount}</span> to revisit
          </li>
        </ul>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Question order
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseOrder("sequential")}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-colors",
                orderMode === "sequential"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              )}
            >
              <p className="text-sm font-semibold text-zinc-900">Sequential</p>
              <p className="mt-1 text-xs text-zinc-600">
                Chapter order — predictable, good for studying a topic through.
              </p>
            </button>
            <button
              type="button"
              onClick={() => chooseOrder("random")}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-colors",
                orderMode === "random"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              )}
            >
              <p className="text-sm font-semibold text-zinc-900">Random</p>
              <p className="mt-1 text-xs text-zinc-600">
                Shuffled within the round — closer to how the mock feels.
              </p>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => startSession("smart")}
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Start {sessionSize}-question round
          </button>
          {struggleCount > 0 ? (
            <button
              type="button"
              onClick={() => startSession("struggles")}
              className="inline-flex w-full items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 hover:bg-amber-100"
            >
              Practice struggles ({Math.min(sessionSize, struggleCount)})
            </button>
          ) : null}
        </div>

        <Link
          href={`/dashboard/english/learn/${courseId}`}
          className="block text-center text-sm font-medium text-emerald-700 hover:text-emerald-600"
        >
          ← Back to course
        </Link>
      </div>
    );
  }

  if (phase === "results") {
    const missQuestions = session.filter((item) =>
      sessionMissIds.includes(item.id)
    );
    const percent =
      total > 0 ? Math.round((sessionCorrect / total) * 100) : 0;

    return (
      <div className="space-y-5">
        <div
          className={cn(
            "rounded-2xl border px-5 py-6 text-center",
            percent >= 75
              ? "border-emerald-300 bg-emerald-50"
              : "border-amber-300 bg-amber-50"
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Round complete
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {sessionCorrect}/{total}
          </p>
          <p className="mt-1 text-sm text-zinc-600">{percent}% this round</p>
          <p className="mt-2 text-xs text-zinc-500">
            Struggle list now has {struggleCount} question
            {struggleCount === 1 ? "" : "s"}
          </p>
        </div>

        {missQuestions.length > 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Missed this round
            </p>
            <ul className="mt-3 space-y-2">
              {missQuestions.map((item) => (
                <li key={item.id} className="text-sm text-zinc-800">
                  <p className="font-medium leading-snug">
                    {item.questionTextPa?.trim() || item.questionText}
                  </p>
                  {item.questionTextPa?.trim() && showEnglish ? (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.questionText}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            No misses this round — nice work.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => startSession("smart")}
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Another {Math.min(PRACTICE_SESSION_SIZE, bank.length)}
          </button>
          {struggleCount > 0 ? (
            <button
              type="button"
              onClick={() => startSession("struggles")}
              className="inline-flex w-full items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
            >
              Practice struggles ({Math.min(PRACTICE_SESSION_SIZE, struggleCount)})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setPhase("setup")}
            className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700"
          >
            Change order settings
          </button>
          <Link
            href={`/dashboard/english/learn/${courseId}`}
            className="block text-center text-sm font-medium text-emerald-700"
          >
            ← Back to course
          </Link>
        </div>
      </div>
    );
  }

  if (!question || total === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Couldn’t build a practice round. Go back and try again.
      </p>
    );
  }

  const isCorrect = selected === question.correctAnswer;
  const promptPa = question.questionTextPa?.trim();
  const explainPa = question.explanationPa?.trim();
  const explainEn = question.explanation?.trim();
  const showPaPlay = Boolean(promptPa || question.questionAudioPaUrl);
  const showEnPlay = showEnglish;
  const struggling = isPracticeStruggle(struggles[question.id]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            Practice round
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {orderMode === "random" ? "Random" : "Sequential"} · {courseName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EnglishOptionSpeechMuteToggle
            muted={optionSpeechMuted}
            onChange={setOptionSpeechMuted}
          />
          <EnglishBilingualToggle
            showEnglish={showEnglish}
            onChange={setShowEnglish}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
        <span>
          Question {index + 1} of {total}
        </span>
        <button
          type="button"
          onClick={() => setPhase("setup")}
          className="text-emerald-700 hover:text-emerald-600"
        >
          End round
        </button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-5">
        {struggling ? (
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            On your struggle list
          </p>
        ) : null}
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
            const labelPa = opt.labelPa?.trim() || "";
            const labelEn = opt.labelEn?.trim() || "";
            const showPaOpt = Boolean(labelPa);
            const showEnOpt =
              showEnglish || !showPaOpt ? Boolean(labelEn) : false;
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
                <span className="min-w-0 space-y-0.5">
                  {showPaOpt ? (
                    <span className="block font-medium text-zinc-900">
                      {labelPa}
                    </span>
                  ) : null}
                  {showEnOpt ? (
                    <span
                      className={cn(
                        "block",
                        showPaOpt ? "text-zinc-600" : "font-medium text-zinc-900"
                      )}
                    >
                      {labelEn}
                    </span>
                  ) : null}
                  {!showPaOpt && !showEnOpt ? (
                    <span className="block font-medium text-zinc-900">
                      {labelEn || labelPa}
                    </span>
                  ) : null}
                </span>
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
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {index >= total - 1 ? "See results" : "Next"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
