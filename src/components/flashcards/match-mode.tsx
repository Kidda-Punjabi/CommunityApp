"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";
import { gameDeckHubHref, shuffleArray } from "@/lib/flashcards/utils";
import { shuffleSeeded } from "@/lib/challenges/seeded-random";
import { saveMatchScoreIfBest } from "@/lib/progress/match-scores";
import { ChallengeModeBanner } from "@/components/challenges/challenge-mode-banner";
import { ChallengePostGameBanner } from "@/components/challenges/challenge-post-game-banner";
import { useChallengeFinish } from "@/lib/challenges/use-challenge-finish";
import type { ChallengePlayContext } from "@/lib/challenges/types";

const GAME_SECONDS = 60;

type Tile = {
  id: string;
  cardId: string;
  text: string;
};

type FlashcardMatchModeProps = {
  deck: FlashcardDeckContext;
  initialBestScore: number;
  challenge?: ChallengePlayContext | null;
};

export function FlashcardMatchMode({
  deck,
  initialBestScore,
  challenge = null,
}: FlashcardMatchModeProps) {
  const deckHubHref = gameDeckHubHref("match");

  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [matchedCardIds, setMatchedCardIds] = useState<Set<string>>(new Set());
  const [wrongTileId, setWrongTileId] = useState<string | null>(null);
  const [pairsMatched, setPairsMatched] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(GAME_SECONDS);
  const [result, setResult] = useState<{
    isNewBest: boolean;
    currentBest: number;
  } | null>(null);

  const userIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const savedRef = useRef(false);

  const [tiles, setTiles] = useState<Tile[]>([]);

  const challengeFinish = useChallengeFinish({
    challengeId: challenge?.id,
    score: pairsMatched,
    scoreMetadata: {
      deck_name: deck.deckName,
      time_seconds: elapsedSeconds,
      correct: pairsMatched,
      total: deck.cards.length,
      accuracy:
        deck.cards.length > 0 ? Math.round((pairsMatched / deck.cards.length) * 100) : 0,
    },
    enabled: phase === "finished" && Boolean(challenge),
  });

  function buildTiles() {
    const list: Tile[] = [];
    for (const card of deck.cards) {
      list.push({ id: `${card.id}-front`, cardId: card.id, text: card.front_text });
      list.push({ id: `${card.id}-back`, cardId: card.id, text: card.back_text });
    }
    return challenge?.config.seed != null
      ? shuffleSeeded(list, challenge.config.seed)
      : shuffleArray(list);
  }

  useEffect(() => {
    if (challenge && phase === "ready") {
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-start friend challenge
  }, [challenge?.id]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setPhase("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const timeUsed = startedAtRef.current
      ? Math.min(GAME_SECONDS, Math.ceil((Date.now() - startedAtRef.current) / 1000))
      : GAME_SECONDS;
    setElapsedSeconds(timeUsed);

    const persist = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const supabase = createClient();
      const outcome = await saveMatchScoreIfBest(
        supabase,
        userId,
        deck.deckName,
        pairsMatched,
        timeUsed,
        deck.cards.length
      );
      setResult({
        isNewBest: outcome.isNewBest,
        currentBest: outcome.currentBest,
      });
    };

    void persist();
  }, [phase, pairsMatched, deck.deckName]);

  useEffect(() => {
    if (pairsMatched === deck.cards.length && phase === "playing") {
      setPhase("finished");
    }
  }, [pairsMatched, deck.cards.length, phase]);

  function startGame() {
    savedRef.current = false;
    setTiles(buildTiles());
    setPhase("playing");
    setSecondsLeft(GAME_SECONDS);
    setSelectedTileId(null);
    setMatchedCardIds(new Set());
    setWrongTileId(null);
    setPairsMatched(0);
    setResult(null);
    startedAtRef.current = Date.now();
  }

  function handleTileClick(tile: Tile) {
    if (phase !== "playing") return;
    if (matchedCardIds.has(tile.cardId)) return;
    if (wrongTileId) return;

    if (!selectedTileId) {
      setSelectedTileId(tile.id);
      return;
    }

    if (selectedTileId === tile.id) {
      setSelectedTileId(null);
      return;
    }

    const firstTile = tiles.find((item) => item.id === selectedTileId);
    if (!firstTile) {
      setSelectedTileId(null);
      return;
    }

    if (firstTile.cardId === tile.cardId) {
      setMatchedCardIds((prev) => new Set(prev).add(tile.cardId));
      setPairsMatched((prev) => prev + 1);
      setSelectedTileId(null);
      return;
    }

    setWrongTileId(tile.id);
    window.setTimeout(() => {
      setWrongTileId(null);
      setSelectedTileId(null);
    }, 500);
  }

  if (phase === "ready" && !challenge) {
    return (
      <div className="space-y-6">
        <div>
          <BackLink fallbackHref={deckHubHref}>← Back</BackLink>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
            Match · {deck.deckName}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{deck.lessonTitle}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Match front and back pairs as fast as you can in {GAME_SECONDS} seconds.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your best
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-900">
            {initialBestScore > 0 ? `${initialBestScore} pairs` : "No score yet"}
          </p>
        </div>

        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Start match game
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="space-y-6">
        {challenge && (
          <ChallengePostGameBanner
            opponentName={challenge.opponentDisplayName}
            result={challengeFinish.result}
            error={challengeFinish.error}
            submitting={challengeFinish.submitting}
          />
        )}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-violet-600">Time&apos;s up</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">
            {pairsMatched} / {deck.cards.length} pairs
          </h2>
          <p className="mt-1 text-sm text-zinc-500">in {elapsedSeconds} seconds</p>
          {result?.isNewBest && (
            <p className="mt-3 text-sm font-semibold text-green-700">New personal best!</p>
          )}
          {result && !result.isNewBest && result.currentBest > 0 && (
            <p className="mt-3 text-sm text-zinc-500">
              Personal best: {result.currentBest} pairs
            </p>
          )}
        </div>
        {!challenge && (
          <button
            type="button"
            onClick={startGame}
            className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Play again
          </button>
        )}
        <BackLink fallbackHref={deckHubHref} className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Back
        </BackLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {challenge && <ChallengeModeBanner challenge={challenge} gameType="match" />}
      <div className="flex items-center justify-between gap-3">
        <BackLink fallbackHref={deckHubHref}>← Back</BackLink>
        <p className="text-sm font-semibold text-zinc-900">
          {pairsMatched} matched · {secondsLeft}s left
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((tile) => {
          const isMatched = matchedCardIds.has(tile.cardId);
          const isSelected = selectedTileId === tile.id;
          const isWrong = wrongTileId === tile.id;

          return (
            <button
              key={tile.id}
              type="button"
              disabled={isMatched}
              onClick={() => handleTileClick(tile)}
              className={`min-h-24 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${
                isMatched
                  ? "border-green-200 bg-green-50 text-green-800 opacity-60"
                  : isWrong
                    ? "border-red-300 bg-red-50 text-red-800"
                    : isSelected
                      ? "border-violet-400 bg-violet-50 text-violet-900"
                      : "border-zinc-200 bg-white text-zinc-900 hover:border-violet-300"
              }`}
            >
              {tile.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
