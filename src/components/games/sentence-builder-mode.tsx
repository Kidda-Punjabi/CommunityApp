"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  answersMatch,
  buildSentenceRound,
  buildTileBank,
  type SentenceBuilderQuestion,
  type SentenceTile,
} from "@/lib/conjugation/sentence-builder";
import {
  buildGrammarTileLexicon,
  filterGrammarSentencesByTenseValue,
} from "@/lib/games/grammar-sentence";
import type { GrammarSentence } from "@/lib/games/types";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameSessionSettings } from "@/components/games/game-session-settings";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import { buildSentenceBuilderLogEntry } from "@/lib/games/session-review-builders";
import type { RoundResult } from "@/lib/games/session-review";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";
const FEEDBACK_MS = 1800;

type Phase = "ready" | "playing" | "finished";
type Feedback = "correct" | "wrong";

type SentenceBuilderModeProps = {
  sentences: GrammarSentence[];
  tableReady: boolean;
  loadError: string | null;
};

export function SentenceBuilderMode({
  sentences,
  tableReady,
  loadError,
}: SentenceBuilderModeProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [questions, setQuestions] = useState<SentenceBuilderQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [bank, setBank] = useState<SentenceTile[]>([]);
  const [built, setBuilt] = useState<SentenceTile[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessionLog, setSessionLog] = useState<RoundResult[]>([]);
  const [pointsEarned, setPointsEarned] = useState(0);
  const lexiconRef = useRef<Map<string, string>>(new Map());

  const advanceTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  const playableSentences = useMemo(
    () => sentences.filter((sentence) => sentence.word_tiles.length > 0),
    [sentences]
  );
  const availableTenseValues = useMemo(() => {
    const values = new Set<string>();
    for (const sentence of playableSentences) {
      if (sentence.tense?.trim()) values.add(sentence.tense.trim());
    }
    return [...values];
  }, [playableSentences]);
  const poolSizeForFilter = useCallback(
    (filterIds: string[]) =>
      filterGrammarSentencesByTenseValue(playableSentences, filterIds).length,
    [playableSentences]
  );

  const current = questions[questionIndex];
  const score = results.filter(Boolean).length;
  const canStart = tableReady && playableSentences.length > 0;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const total = questions.length;
    const correct = results.filter(Boolean).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, "sentence_builder", correct, {
        accuracy,
        correct,
        total,
        rounds: total,
        sessionLog,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, questions.length, results, sessionLog]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  function loadQuestion(
    question: SentenceBuilderQuestion,
    lexicon: Map<string, string>
  ) {
    setBank(buildTileBank(question, sentences, lexicon));
    setBuilt([]);
    setFeedback(null);
  }

  function startRound(choice: GameSessionSettingsChoice) {
    savedRef.current = false;
    const round = buildSentenceRound(sentences, {
      questionCount: choice.questionCount,
      tenseFilter: choice.filterIds,
    });
    if (round.questions.length === 0) return;

    const lexicon = buildGrammarTileLexicon(sentences);
    lexiconRef.current = lexicon;

    setQuestions(round.questions);
    setQuestionIndex(0);
    setResults([]);
    setSessionLog([]);
    loadQuestion(round.questions[0], lexicon);
    setPhase("playing");
  }

  function advanceRound(wasCorrect: boolean) {
    const nextResults = [...results, wasCorrect];

    if (questionIndex + 1 >= questions.length) {
      setResults(nextResults);
      setPhase("finished");
      return;
    }

    const nextIndex = questionIndex + 1;
    setResults(nextResults);
    setQuestionIndex(nextIndex);
    loadQuestion(questions[nextIndex], lexiconRef.current);
  }

  function moveToBuilt(tile: SentenceTile) {
    if (feedback) return;
    setBank((prev) => prev.filter((item) => item.id !== tile.id));
    setBuilt((prev) => [...prev, tile]);
  }

  function moveToBank(tile: SentenceTile) {
    if (feedback) return;
    setBuilt((prev) => prev.filter((item) => item.id !== tile.id));
    setBank((prev) => [...prev, tile]);
  }

  function handleCheck() {
    if (!current || feedback || built.length === 0) return;

    const attempt = built.map((tile) => tile.word);
    const isCorrect = answersMatch(attempt, current.correctTiles);
    setSessionLog((prev) => [
      ...prev,
      buildSentenceBuilderLogEntry(current, built, isCorrect),
    ]);
    setFeedback(isCorrect ? "correct" : "wrong");

    advanceTimerRef.current = window.setTimeout(() => {
      advanceRound(isCorrect);
    }, FEEDBACK_MS);
  }

  if (phase === "ready") {
    return (
      <GameSessionSettings
        gameTitle="Form the sentence"
        gameEyebrow="Sentence Builder"
        gameDescription="Tap word tiles in order to build Punjabi sentences from the English prompt."
        filterLabel="Tense"
        tenseFilterValues={availableTenseValues}
        poolSizeForFilter={poolSizeForFilter}
        canStart={canStart}
        unavailableMessage={
          !tableReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Run <code className="text-xs">supabase/games.sql</code> to enable this game.
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Could not load grammar sentences: {loadError}
            </div>
          ) : playableSentences.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No grammar sentences found yet. More course content is coming soon.
            </div>
          ) : undefined
        }
        onStart={startRound}
      />
    );
  }

  if (phase === "finished") {
    const total = questions.length;

    return (
      <GameSessionReview
        title="Round complete"
        correct={score}
        total={total}
        sessionLog={sessionLog}
        pointsEarned={pointsEarned}
        onPlayAgain={() => setPhase("ready")}
      />
    );
  }

  const progress = ((questionIndex + 1) / questions.length) * 100;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={GAMES_HUB_HREF}
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            ← Exit
          </Link>
          <p className="text-sm font-semibold text-zinc-900">
            {score} correct
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500">
          Question {questionIndex + 1} of {questions.length}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Form the sentence in Punjabi
        </p>
        <p className="mt-3 text-lg font-semibold text-zinc-900">{current?.englishPrompt}</p>
      </div>

      <div
        className={`min-h-20 rounded-xl border-2 border-dashed p-3 transition-colors ${
          feedback === "correct"
            ? "border-green-300 bg-green-50"
            : feedback === "wrong"
              ? "border-red-300 bg-red-50"
              : "border-violet-200 bg-violet-50/50"
        }`}
      >
        <div className="flex min-h-10 flex-wrap gap-2">
          {built.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => moveToBank(tile)}
              disabled={Boolean(feedback)}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-80"
            >
              <span>{tile.word}</span>
              {tile.romanised && (
                <span className="mt-0.5 block text-xs font-normal text-violet-200">
                  {tile.romanised}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {feedback && current && (
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-zinc-900">
            {current.correctTiles.join(" ")}
          </p>
          {current.romanised && (
            <p className="text-sm text-violet-600">{current.romanised}</p>
          )}
        </div>
      )}

      {feedback === "wrong" && current && (
        <p className="text-center text-xs text-zinc-500">Try again on the next question.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {bank.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => moveToBuilt(tile)}
            disabled={Boolean(feedback)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:border-violet-300 disabled:opacity-70"
          >
            <span>{tile.word}</span>
            {tile.romanised && (
              <span className="mt-0.5 block text-xs font-normal text-violet-600">
                {tile.romanised}
              </span>
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCheck}
        disabled={built.length === 0 || Boolean(feedback)}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
      >
        Check
      </button>
    </div>
  );
}
