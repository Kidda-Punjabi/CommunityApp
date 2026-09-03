"use client";

import { BackLink } from "@/components/navigation/back-link";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import {
  WORD_START_DISPLAY_NAME,
  WORD_START_QUESTION_COUNTS,
  buildWordStartRound,
  letterLabel,
  type WordStartGameWord,
  type WordStartQuestion,
  type WordStartQuestionResult,
} from "@/lib/games/word-start";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";
import { Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_MS = 1100;

type Phase = "setup" | "playing" | "finished";

type WordStartModeProps = {
  words: WordStartGameWord[];
  loadError: string | null;
};

export function WordStartMode({ words, loadError }: WordStartModeProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [questionCount, setQuestionCount] = useState<(typeof WORD_START_QUESTION_COUNTS)[number]>(
    10
  );
  const [questions, setQuestions] = useState<WordStartQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<WordStartQuestionResult[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; selected: string } | null>(
    null
  );
  const [pointsEarned, setPointsEarned] = useState(0);

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { playSound } = useAudioManager();

  const current = questions[questionIndex];
  const correctCount = results.filter((result) => result.is_correct).length;

  const playCurrentAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current?.word.audio_pa_url) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay can fail until the student taps Replay.
    });
  }, [current?.word.audio_pa_url]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    setFeedback(null);
    playCurrentAudio();
  }, [phase, questionIndex, current?.word.id, playCurrentAudio]);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const total = questions.length;
      const correct = results.filter((result) => result.is_correct).length;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "word_start", correct, {
        question_count: total,
        correct_count: correct,
        correct,
        total,
        accuracy,
        per_question_results: results,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, questions.length, results]);

  function startRound() {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    const nextQuestions = buildWordStartRound(words, questionCount);
    if (nextQuestions.length === 0) return;
    savedRef.current = false;
    setQuestions(nextQuestions);
    setQuestionIndex(0);
    setResults([]);
    setFeedback(null);
    setPointsEarned(0);
    setPhase("playing");
  }

  function chooseOption(option: string) {
    if (!current || feedback) return;

    const isCorrect = option === current.word.starting_letter;
    playSound(isCorrect ? "correct" : "incorrect");

    const result: WordStartQuestionResult = {
      word_id: current.word.id,
      word_gurmukhi: current.word.word_gurmukhi,
      romanised: current.word.romanised,
      selected: option,
      correct: current.word.starting_letter,
      is_correct: isCorrect,
    };

    setFeedback({ isCorrect, selected: option });

    advanceTimerRef.current = window.setTimeout(() => {
      const nextResults = [...results, result];
      if (questionIndex + 1 >= questions.length) {
        setResults(nextResults);
        setFeedback(null);
        setPhase("finished");
        return;
      }
      setResults(nextResults);
      setQuestionIndex((index) => index + 1);
    }, FEEDBACK_MS);
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <BackLink fallbackHref={GAMES_HUB_HREF}>← Games</BackLink>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Could not load Word Start: {loadError}
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    const startDisabled = words.length === 0;
    const repeatWarning =
      words.length > 0 && questionCount > words.length
        ? `This set has ${words.length} words — you'll hear some more than once.`
        : null;

    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <BackLink fallbackHref={GAMES_HUB_HREF}>← Back</BackLink>
            <GameTutorialHost tutorialId="word_start" />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Vocab game
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{WORD_START_DISPLAY_NAME}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Listen to a Punjabi word and pick the letter it starts with.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Number of questions
          </p>
          <div className="flex flex-wrap gap-2">
            {WORD_START_QUESTION_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setQuestionCount(count)}
                className={questionCount === count ? ui.pillActive : ui.pillInactive}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {repeatWarning ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {repeatWarning}
          </p>
        ) : null}

        {startDisabled ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Word audio is not ready yet. The word list is waiting for review before recordings are
            generated.
          </p>
        ) : null}

        <button
          type="button"
          onClick={startRound}
          disabled={startDisabled}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <GameSessionReview
        title="Round complete"
        correct={correctCount}
        total={questions.length}
        sessionLog={results.map((result) => ({
          prompt: result.word_gurmukhi,
          promptRomanised: result.romanised,
          userAnswer: letterLabel(result.selected),
          correctAnswer: letterLabel(result.correct),
          wasCorrect: result.is_correct,
        }))}
        pointsEarned={pointsEarned}
        onPlayAgain={() => setPhase("setup")}
      />
    );
  }

  return (
    <div className="relative space-y-3">
      <FloatingSoundToggle />
      <SessionProgressBar current={questionIndex + 1} total={questions.length} />
      {current ? <audio ref={audioRef} src={current.word.audio_pa_url} preload="auto" /> : null}

      <div className="flex items-center justify-between gap-3">
        <BackLink
          fallbackHref={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Exit
        </BackLink>
        <div className="flex items-center gap-2">
          <GameTutorialHost tutorialId="word_start" />
          <p className="text-sm font-semibold text-zinc-900">
            {questionIndex + 1} / {questions.length} · {correctCount} correct
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {WORD_START_DISPLAY_NAME}
        </p>
        <p className="mt-2 text-center text-lg font-semibold text-zinc-900">
          What does this word start with?
        </p>
        <p className="mt-1 text-center text-sm text-zinc-500">
          Audio plays automatically. Replay as many times as you need.
        </p>
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={playCurrentAudio} className={ui.btnSecondary}>
            <Volume2 className="mr-2 h-4 w-4" aria-hidden />
            Replay
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        {current?.options.map((option) => {
          const showResult = feedback !== null;
          const isCorrectOption = option === current.word.starting_letter;
          const isChosen = feedback?.selected === option;

          let className =
            "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ";
          if (showResult) {
            if (isCorrectOption) {
              className += "border-green-400 bg-green-50";
            } else if (isChosen) {
              className += "border-red-300 bg-red-50";
            } else {
              className += "border-zinc-200 bg-white opacity-60";
            }
          } else {
            className += "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/40";
          }

          return (
            <button
              key={option}
              type="button"
              disabled={showResult}
              onClick={() => chooseOption(option)}
              className={className}
            >
              <span className="text-lg font-semibold text-zinc-900">{letterLabel(option)}</span>
            </button>
          );
        })}
      </div>

      {feedback ? (
        <p
          className={`text-center text-sm font-medium ${
            feedback.isCorrect ? "text-green-700" : "text-amber-800"
          }`}
        >
          {feedback.isCorrect
            ? "Correct!"
            : `Not quite — ${letterLabel(current.word.starting_letter)}`}
        </p>
      ) : null}
    </div>
  );
}
