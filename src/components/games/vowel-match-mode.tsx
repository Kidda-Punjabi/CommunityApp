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
  buildVowelMatchRound,
  sameVowelSet,
  vowelMatchLabel,
  VOWEL_MATCH_DISPLAY_NAME,
  type VowelGameWord,
  type VowelMatchId,
  type VowelMatchQuestion,
  type VowelMatchQuestionResult,
} from "@/lib/games/vowel-match";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";
import { Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_MS = 1400;

type Phase = "playing" | "finished";

type VowelMatchModeProps = {
  words: VowelGameWord[];
  loadError: string | null;
};

function sortedIds(ids: VowelMatchId[]): VowelMatchId[] {
  return [...ids].sort();
}

export function VowelMatchMode({ words, loadError }: VowelMatchModeProps) {
  const [phase, setPhase] = useState<Phase>("playing");
  const [questions, setQuestions] = useState<VowelMatchQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<VowelMatchId[]>([]);
  const [results, setResults] = useState<VowelMatchQuestionResult[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean } | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [ready, setReady] = useState(false);

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
    if (words.length === 0) return;
    setQuestions(buildVowelMatchRound(words));
    setQuestionIndex(0);
    setSelected([]);
    setResults([]);
    setFeedback(null);
    setReady(true);
  }, [words]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setSelected([]);
    setFeedback(null);
    playCurrentAudio();
  }, [questionIndex, current?.word.id, playCurrentAudio]);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const questionCount = questions.length;
      const correct = results.filter((result) => result.is_correct).length;
      const accuracy = questionCount > 0 ? Math.round((correct / questionCount) * 100) : 0;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "vowel_match", correct, {
        question_count: questionCount,
        correct_count: correct,
        correct,
        total: questionCount,
        accuracy,
        per_question_results: results,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, questions.length, results]);

  function startNewRound() {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    savedRef.current = false;
    setQuestions(buildVowelMatchRound(words));
    setQuestionIndex(0);
    setSelected([]);
    setResults([]);
    setFeedback(null);
    setPointsEarned(0);
    setPhase("playing");
    setReady(true);
  }

  function toggleOption(id: VowelMatchId) {
    if (feedback) return;
    setSelected((currentSelected) =>
      currentSelected.includes(id)
        ? currentSelected.filter((item) => item !== id)
        : [...currentSelected, id]
    );
  }

  function submitAnswer() {
    if (!current || feedback || selected.length === 0) return;

    const correct = current.word.vowels_tested;
    const isCorrect = sameVowelSet(selected, correct);
    playSound(isCorrect ? "correct" : "incorrect");

    const result: VowelMatchQuestionResult = {
      word_id: current.word.id,
      word_gurmukhi: current.word.word_gurmukhi,
      selected: sortedIds(selected),
      correct: sortedIds(correct),
      is_correct: isCorrect,
    };

    setFeedback({ isCorrect });

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

  if (loadError || words.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink fallbackHref={GAMES_HUB_HREF}>← Games</BackLink>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError
            ? `Could not load Vowel Match: ${loadError}`
            : "Vowel Match words are not ready yet."}
        </div>
      </div>
    );
  }

  if (!ready || !current) {
    return (
      <div className="space-y-4">
        <BackLink fallbackHref={GAMES_HUB_HREF}>← Games</BackLink>
        <p className="text-sm text-zinc-500">Loading round…</p>
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
          userAnswer: result.selected.map(vowelMatchLabel).join(", ") || "No selection",
          correctAnswer: result.correct.map(vowelMatchLabel).join(", "),
          wasCorrect: result.is_correct,
        }))}
        pointsEarned={pointsEarned}
        onPlayAgain={startNewRound}
      />
    );
  }

  return (
    <div className="relative space-y-3">
      <FloatingSoundToggle />
      <SessionProgressBar current={questionIndex + 1} total={questions.length} />
      {current ? (
        <audio ref={audioRef} src={current.word.audio_pa_url} preload="auto" />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <BackLink
          fallbackHref={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Exit
        </BackLink>
        <div className="flex items-center gap-2">
          <GameTutorialHost tutorialId="vowel_match" />
          <p className="text-sm font-semibold text-zinc-900">
            {questionIndex + 1} / {questions.length} · {correctCount} correct
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {VOWEL_MATCH_DISPLAY_NAME}
        </p>
        <p className="mt-2 text-center text-lg font-semibold text-zinc-900">
          Which vowel(s) do you hear?
        </p>
        <p className="mt-1 text-center text-sm text-zinc-500">
          Select every matra in the word, then submit.
        </p>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={playCurrentAudio}
            className={ui.btnSecondary}
          >
            <Volume2 className="mr-2 h-4 w-4" aria-hidden />
            Replay
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        {current?.options.map((option) => {
          const isChosen = selected.includes(option.id);
          const isCorrectOption = current.word.vowels_tested.includes(option.id);
          const showResult = feedback !== null;

          let className = "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ";
          if (showResult) {
            if (isCorrectOption) {
              className += "border-green-400 bg-green-50";
            } else if (isChosen) {
              className += "border-red-300 bg-red-50";
            } else {
              className += "border-zinc-200 bg-white opacity-60";
            }
          } else if (isChosen) {
            className += "border-violet-400 bg-violet-50";
          } else {
            className += "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/40";
          }

          return (
            <button
              key={option.id}
              type="button"
              disabled={showResult}
              onClick={() => toggleOption(option.id)}
              className={className}
              aria-pressed={isChosen}
            >
              <span className="font-semibold text-zinc-900">{vowelMatchLabel(option.id)}</span>
              {!showResult && isChosen ? (
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                  Selected
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={submitAnswer}
        disabled={Boolean(feedback) || selected.length === 0}
        className={ui.btnPrimaryBlock}
      >
        Submit
      </button>

      {feedback ? (
        <p
          className={`text-center text-sm font-medium ${
            feedback.isCorrect ? "text-green-700" : "text-amber-800"
          }`}
        >
          {feedback.isCorrect
            ? "Correct!"
            : `Not quite — ${current?.word.vowels_tested.map(vowelMatchLabel).join(", ")}`}
        </p>
      ) : null}
    </div>
  );
}
