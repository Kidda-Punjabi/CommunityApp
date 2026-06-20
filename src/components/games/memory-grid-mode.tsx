"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";
import { saveGameScoreIfBest } from "@/lib/games/game-scores";
import {
  buildGridTilesFromPairs,
  createMemoryGridBatches,
  type MemoryGridTile,
} from "@/lib/games/memory-grid-batches";
import { buildGameAccuracyMetadata } from "@/lib/leaderboard/points";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";

type MemoryGridModeProps = {
  deck: FlashcardDeckContext;
  initialBestScore: number;
};

export function MemoryGridMode({ deck, initialBestScore }: MemoryGridModeProps) {
  const backHref = `/dashboard/games/memory-grid`;

  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [cards, setCards] = useState<MemoryGridTile[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchPairsFound, setBatchPairsFound] = useState(0);
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [matchedCardIds, setMatchedCardIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [pairsFound, setPairsFound] = useState(0);
  const [moves, setMoves] = useState(0);
  const [result, setResult] = useState<{
    isNewBest: boolean;
    currentBest: number;
    pointsEarned: number;
  } | null>(null);

  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const batchesRef = useRef<ReturnType<typeof createMemoryGridBatches>>([]);

  const totalBatches = batchesRef.current.length;
  const currentBatchSize = batchesRef.current[batchIndex]?.length ?? 0;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  function loadBatch(index: number) {
    const batch = batchesRef.current[index];
    if (!batch) return;

    setCards(buildGridTilesFromPairs(batch));
    setBatchIndex(index);
    setBatchPairsFound(0);
    setFlippedIds(new Set());
    setMatchedCardIds(new Set());
    setSelectedId(null);
    setWrongId(null);
  }

  useEffect(() => {
    if (phase !== "playing" || currentBatchSize === 0) return;
    if (batchPairsFound < currentBatchSize) return;

    const nextIndex = batchIndex + 1;
    if (nextIndex < batchesRef.current.length) {
      loadBatch(nextIndex);
      return;
    }

    if (pairsFound >= deck.cards.length) {
      setPhase("finished");
    }
  }, [batchPairsFound, batchIndex, currentBatchSize, phase, pairsFound, deck.cards.length]);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveGameScoreIfBest(
        supabase,
        userId,
        "memory_grid",
        pairsFound,
        {
          deck_name: deck.deckName,
          moves,
          ...buildGameAccuracyMetadata(pairsFound, deck.cards.length),
        }
      );
      setResult({
        isNewBest: outcome.isNewBest,
        currentBest: outcome.currentBest,
        pointsEarned: outcome.pointsEarned,
      });
    };

    void persist();
  }, [phase, pairsFound, deck.deckName, moves]);

  function startGame() {
    savedRef.current = false;
    batchesRef.current = createMemoryGridBatches(deck.cards);
    setPairsFound(0);
    setMoves(0);
    setResult(null);
    loadBatch(0);
    setPhase("playing");
  }

  function handleCardClick(card: MemoryGridTile) {
    if (phase !== "playing") return;
    if (matchedCardIds.has(card.cardId)) return;
    if (flippedIds.has(card.id)) return;
    if (wrongId) return;

    const nextFlipped = new Set(flippedIds).add(card.id);
    setFlippedIds(nextFlipped);

    if (!selectedId) {
      setSelectedId(card.id);
      return;
    }

    if (selectedId === card.id) return;

    const first = cards.find((c) => c.id === selectedId);
    if (!first) {
      setSelectedId(null);
      return;
    }

    setMoves((m) => m + 1);

    if (first.cardId === card.cardId && first.side !== card.side) {
      setMatchedCardIds((prev) => new Set(prev).add(card.cardId));
      setPairsFound((p) => p + 1);
      setBatchPairsFound((p) => p + 1);
      setSelectedId(null);
      return;
    }

    setWrongId(card.id);
    window.setTimeout(() => {
      setFlippedIds(new Set());
      setWrongId(null);
      setSelectedId(null);
    }, 700);
  }

  if (phase === "ready") {
    const usesBatching = deck.cards.length > 6;

    return (
      <div className="space-y-6">
        <div>
          <Link href={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Back to decks
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Memory Grid · {deck.deckName}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{deck.lessonTitle}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Flip cards and match front/back pairs from memory.
            {usesBatching && " Larger sets play in batches of 6 pairs at a time."}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your best</p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {initialBestScore > 0 ? `${initialBestScore} pairs` : "No score yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Start game
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-violet-600">Complete!</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">
            {pairsFound} / {deck.cards.length} pairs
          </h2>
          <p className="mt-1 text-sm text-zinc-500">{moves} moves</p>
          <PointsEarnedBadge points={result?.pointsEarned ?? 0} className="mt-3" />
          {result?.isNewBest && (
            <p className="mt-3 text-sm font-semibold text-green-700">New personal best!</p>
          )}
          {result && !result.isNewBest && result.currentBest > 0 && (
            <p className="mt-3 text-sm text-zinc-500">Personal best: {result.currentBest}</p>
          )}
        </div>
        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Play again
        </button>
        <Link href={backHref} className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500">
          Back to decks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Exit
        </Link>
        <p className="text-sm font-semibold text-zinc-900">
          {pairsFound} / {deck.cards.length} pairs · {moves} moves
          {totalBatches > 1 && (
            <span className="font-normal text-zinc-500">
              {" "}
              · batch {batchIndex + 1}/{totalBatches}
            </span>
          )}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cards.map((card) => {
          const isMatched = matchedCardIds.has(card.cardId);
          const isFlipped = flippedIds.has(card.id) || isMatched;
          const isWrong = wrongId === card.id;

          return (
            <button
              key={card.id}
              type="button"
              disabled={isMatched}
              onClick={() => handleCardClick(card)}
              className={`flex min-h-20 items-center justify-center rounded-xl border px-2 py-2 text-center text-xs font-medium transition-colors sm:text-sm ${
                isMatched
                  ? "border-green-200 bg-green-50 text-green-800 opacity-60"
                  : isWrong
                    ? "border-red-300 bg-red-50 text-red-800"
                    : isFlipped
                      ? "border-violet-400 bg-violet-50 text-violet-900"
                      : "border-zinc-200 bg-violet-600 text-white hover:bg-violet-500"
              }`}
            >
              {isFlipped ? card.text : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
