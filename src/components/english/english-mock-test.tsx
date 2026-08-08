"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { EnglishBilingualToggle } from "@/components/english/english-bilingual-toggle";
import type {
  EnglishExamCourseConfig,
  EnglishExamQuestion,
} from "@/lib/learning/english-exam-courses";
import {
  drawEnglishMockQuestions,
  filterEnglishQuestionsByLesson,
  scoreEnglishExamByChapter,
  shuffleEnglishExamQuestions,
} from "@/lib/learning/load-english-exam-content";
import {
  applySpeechPlaybackRate,
  useSpeechPlaybackRate,
} from "@/lib/audio/speech-playback";
import { cn } from "@/lib/ui/styles";

type EnglishMockTestProps = {
  courseName: string;
  courseId: string;
  config: EnglishExamCourseConfig;
  bank: EnglishExamQuestion[];
  /** When set, run an untimed chapter test with that lesson's questions. */
  chapterLessonId?: string | null;
  chapterTitle?: string | null;
};

type Phase = "intro" | "testing" | "results";
/** Full mock only — chapter tests always stay bilingual (support). */
type MockMode = "support" | "exam";
type LangKey = "punjabi" | "english";

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function shortChapterLabel(title: string, lessonNumber: number | null) {
  const match = title.match(/chapter\s*\d+/i);
  if (match) return match[0];
  if (lessonNumber != null) return `Chapter ${lessonNumber}`;
  // Drop bilingual trailing half ("English / ਪੰਜਾਬੀ") for exam-facing labels.
  return title.split("/")[0]?.trim() || title;
}

function englishChapterTitle(title: string, lessonNumber: number | null) {
  const englishHalf = title.split("/")[0]?.trim();
  if (englishHalf) return englishHalf;
  return shortChapterLabel(title, lessonNumber);
}

function playAudioUrl(url: string, audio: HTMLAudioElement) {
  return new Promise<void>((resolve, reject) => {
    audio.src = url;
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Playback failed"));
    void audio.play().catch(reject);
  });
}

export function EnglishMockTest({
  courseName,
  courseId,
  config,
  bank,
  chapterLessonId = null,
  chapterTitle = null,
}: EnglishMockTestProps) {
  const isChapterMode = Boolean(chapterLessonId);
  const chapterBank = useMemo(
    () =>
      chapterLessonId
        ? filterEnglishQuestionsByLesson(bank, chapterLessonId)
        : bank,
    [bank, chapterLessonId]
  );

  const [phase, setPhase] = useState<Phase>("intro");
  const [mockMode, setMockMode] = useState<MockMode>("support");
  const [questions, setQuestions] = useState<EnglishExamQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(config.mockMinutes * 60);
  const [showEnglish, setShowEnglish] = useState(true);
  const [playingLang, setPlayingLang] = useState<LangKey | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const finishedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { rate: speechRate } = useSpeechPlaybackRate();

  const isExamMode = !isChapterMode && mockMode === "exam";
  /** Full mock "With support" — not chapter tests (those stay as before). */
  const isSupportMock = !isChapterMode && mockMode === "support";
  const question = questions[index];
  const answeredCount = Object.keys(answers).length;

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

  const score = useMemo(() => {
    let correct = 0;
    for (const item of questions) {
      if (answers[item.id] === item.correctAnswer) correct += 1;
    }
    return correct;
  }, [answers, questions]);

  const chapterScores = useMemo(
    () => scoreEnglishExamByChapter(questions, answers, courseId),
    [answers, courseId, questions]
  );

  const passed = isChapterMode
    ? questions.length > 0 && score / questions.length >= 0.75
    : score >= config.passCorrect;
  const percent =
    questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
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

  useEffect(() => {
    audioRef.current?.pause();
    setPlayingLang(null);
  }, [index, phase]);

  function startTest(mode: MockMode = mockMode) {
    finishedRef.current = false;
    setMockMode(mode);
    setShowEnglish(true);
    const drawn = isChapterMode
      ? shuffleEnglishExamQuestions(chapterBank)
      : drawEnglishMockQuestions(bank, config.mockQuestionCount);
    setQuestions(drawn);
    setAnswers({});
    setIndex(0);
    setSecondsLeft(config.mockMinutes * 60);
    setPhase("testing");
  }

  function finishTest() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    audioRef.current?.pause();
    setPlayingLang(null);
    setPhase("results");
  }

  const handlePlay = useCallback(
    async (lang: LangKey) => {
      if (!question) return;
      if (isExamMode && lang === "punjabi") return;
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
    [isExamMode, question, speechRate]
  );

  useEffect(() => {
    if (phase !== "testing" || isChapterMode) return;
    if (secondsLeft <= 0) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        setPhase("results");
      }
      return;
    }
    const id = window.setTimeout(() => {
      setSecondsLeft((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [phase, secondsLeft, isChapterMode]);

  if (chapterBank.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No questions are available for this {isChapterMode ? "chapter" : "course"}{" "}
        yet.
      </p>
    );
  }

  if (phase === "intro") {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            {isChapterMode ? "Chapter test" : "Mock test"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            {isChapterMode ? chapterTitle || courseName : courseName}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {isChapterMode
              ? "Practice just this chapter — untimed, all questions from the chapter bank."
              : "Timed practice matching the real exam format (multiple-choice only)."}
          </p>
        </div>

        <ul className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 text-sm text-emerald-950">
          {isChapterMode ? (
            <>
              <li>
                <span className="font-semibold">{chapterBank.length}</span> chapter
                questions
              </li>
              <li>Untimed · see explanations on the full practice bank</li>
              <li>Results include a chapter score you can restudy from</li>
            </>
          ) : (
            <>
              <li>
                <span className="font-semibold">{config.mockQuestionCount}</span>{" "}
                questions (random, no repeats)
              </li>
              <li>
                <span className="font-semibold">{config.mockMinutes}</span> minutes
              </li>
              <li>
                Pass mark:{" "}
                <span className="font-semibold">
                  {config.passCorrect}/{config.mockQuestionCount}
                </span>{" "}
                ({config.passPercent}%)
              </li>
            </>
          )}
        </ul>

        {isChapterMode ? (
          <button
            type="button"
            onClick={() => startTest("support")}
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Start chapter test
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Choose how you want to sit this mock
            </p>
            <button
              type="button"
              onClick={() => startTest("support")}
              className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-4 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/50"
            >
              <p className="text-sm font-semibold text-zinc-900">With support</p>
              <p className="mt-1 text-sm leading-snug text-zinc-600">
                Punjabi + English questions and options, language toggle, and
                audio in both languages — same bilingual help as practice.
              </p>
            </button>
            <button
              type="button"
              onClick={() => startTest("exam")}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/50"
            >
              <p className="text-sm font-semibold text-zinc-900">
                Full English (exam simulation)
              </p>
              <p className="mt-1 text-sm leading-snug text-zinc-600">
                English only — no Punjabi text, options, toggle, or Punjabi
                audio. Closest to sitting the real test.
              </p>
            </button>
          </div>
        )}

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
    const weakest = [...chapterScores]
      .filter((row) => row.total > 0)
      .sort((a, b) => a.percent - b.percent);

    const chapterLabel = (title: string, lessonNumber: number | null) =>
      isExamMode
        ? englishChapterTitle(title, lessonNumber)
        : shortChapterLabel(title, lessonNumber);

    return (
      <div className="space-y-5">
        <div
          className={cn(
            "rounded-2xl border px-5 py-6 text-center",
            passed
              ? "border-emerald-300 bg-emerald-50"
              : "border-amber-300 bg-amber-50"
          )}
        >
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              passed ? "text-emerald-700" : "text-amber-800"
            )}
          >
            {passed ? "Pass" : "Not yet"}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {score}/{questions.length}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {percent}%
            {!isChapterMode
              ? ` · need ${config.passCorrect}/${config.mockQuestionCount} (${config.passPercent}%) to pass`
              : " on this chapter"}
          </p>
          {!isChapterMode ? (
            <p className="mt-2 text-xs font-medium text-zinc-500">
              {isExamMode
                ? "Full English (exam simulation)"
                : "With support"}
            </p>
          ) : null}
        </div>

        {chapterScores.length > 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              By chapter
            </p>
            <ul className="mt-3 space-y-2">
              {chapterScores.map((row) => (
                <li
                  key={row.lessonId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900">
                      {chapterLabel(row.chapterTitle, row.lessonNumber)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {row.correct}/{row.total} correct
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "tabular-nums font-semibold",
                        row.percent >= 75 ? "text-emerald-700" : "text-amber-700"
                      )}
                    >
                      {row.percent}%
                    </span>
                    <Link
                      href={row.materialsHref}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-600"
                    >
                      Study
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            {weakest[0] && weakest[0].percent < 100 ? (
              <p className="mt-3 text-xs text-zinc-500">
                Weakest:{" "}
                <Link
                  href={weakest[0].materialsHref}
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  {chapterLabel(
                    weakest[0].chapterTitle,
                    weakest[0].lessonNumber
                  )}
                </Link>{" "}
                — reopen the chapter reader to restudy.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {isChapterMode ? (
            <button
              type="button"
              onClick={() => startTest("support")}
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Try again
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPhase("intro")}
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Try again
            </button>
          )}
          {!isChapterMode ? (
            <Link
              href={`/dashboard/english/learn/${courseId}/materials`}
              className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800"
            >
              Review chapter materials
            </Link>
          ) : (
            <Link
              href={`/dashboard/english/learn/${courseId}/materials/${chapterLessonId}`}
              className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800"
            >
              Back to chapter reader
            </Link>
          )}
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

  if (!question) return null;

  const promptPa = !isExamMode ? question.questionTextPa?.trim() : "";
  const showPaPrompt = Boolean(promptPa);
  const showEnPrompt = isExamMode || showEnglish || !showPaPrompt;
  const showPaPlay =
    !isExamMode && Boolean(promptPa || question.questionAudioPaUrl);
  const showEnPlay = isExamMode || showEnglish;
  const urgent = !isChapterMode && secondsLeft <= 60;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!isChapterMode ? (
          <div
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums",
              urgent ? "bg-red-100 text-red-800" : "bg-zinc-100 text-zinc-800"
            )}
            aria-live="polite"
          >
            {formatClock(secondsLeft)}
          </div>
        ) : (
          <p className="text-xs font-medium text-zinc-500">Untimed chapter test</p>
        )}
        {!isExamMode ? (
          <EnglishBilingualToggle
            showEnglish={showEnglish}
            onChange={setShowEnglish}
          />
        ) : (
          <p className="text-xs font-medium text-zinc-500">Exam simulation</p>
        )}
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <span>
          Answered {answeredCount}/{questions.length}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {showPaPrompt ? (
              <p className="text-base font-medium leading-snug text-zinc-900">
                {promptPa}
              </p>
            ) : null}
            {showEnPrompt ? (
              <p
                className={cn(
                  "text-sm leading-snug text-zinc-600",
                  showPaPrompt ? "" : "text-base font-medium text-zinc-900"
                )}
              >
                {question.questionText}
              </p>
            ) : null}
          </div>

          {!isChapterMode ? (
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
                      : "border-emerald-600 text-emerald-700 hover:bg-emerald-50",
                    isExamMode &&
                      "border-0 bg-emerald-600 text-white hover:bg-emerald-500"
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
          ) : null}
        </div>

        {audioNotice ? (
          <p className="mt-2 text-xs font-medium text-amber-700">{audioNotice}</p>
        ) : null}

        <div className="mt-4 space-y-2">
          {optionLabels.map((opt) => {
            const chosen = answers[question.id] === opt.key;
            const labelPa = opt.labelPa?.trim() || "";
            const labelEn = opt.labelEn?.trim() || "";
            // Chapter tests keep English-only options; support mock shows PA when present.
            const showPaOpt = isSupportMock && Boolean(labelPa);
            const showEnOpt =
              isExamMode || isChapterMode || showEnglish || !showPaOpt
                ? Boolean(labelEn)
                : false;

            return (
              <button
                key={opt.key}
                type="button"
                onClick={() =>
                  setAnswers((prev) => ({ ...prev, [question.id]: opt.key }))
                }
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                  chosen
                    ? "border-emerald-400 bg-emerald-50 text-zinc-900"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-emerald-300"
                )}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
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
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-40"
        >
          Previous
        </button>
        {index < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((value) => value + 1)}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={finishTest}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Submit test
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={finishTest}
        className="w-full text-center text-xs font-medium text-zinc-500 underline-offset-2 hover:underline"
      >
        End test early
      </button>
    </div>
  );
}
