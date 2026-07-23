"use client";

import { FlashcardBilingualLine } from "@/components/flashcards/flashcard-bilingual-line";
import { BackLink } from "@/components/navigation/back-link";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { useEffect, useRef, useState } from "react";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { usePlaySoundOnce } from "@/lib/audio/use-play-sound";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";
import { gameDeckHubHref, shuffleArray } from "@/lib/flashcards/utils";
import { shuffleSeeded } from "@/lib/challenges/seeded-random";
import { ChallengeModeBanner } from "@/components/challenges/challenge-mode-banner";
import { ChallengePostGameBanner } from "@/components/challenges/challenge-post-game-banner";
import { useChallengeFinish } from "@/lib/challenges/use-challenge-finish";
import type { ChallengePlayContext } from "@/lib/challenges/types";

const GAME_SECONDS = 60;

type Tile = {
  id: string;
  cardId: string;
  text: string;
  romanised: string | null;
};

type FlashcardMatchModeProps = {
  deck: FlashcardDeckContext;
  initialBestScore: number;
  challenge?: ChallengePlayContext | null;
  kidsMode?: boolean;
  onKidsComplete?: (score: number) => void | Promise<void>;
};

export function FlashcardMatchMode({
  deck,
  initialBestScore,
  challenge = null,
  kidsMode = false,
  onKidsComplete,
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  const startedAtRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const kidsCompleteRef = useRef(false);
  const { playSound } = useAudioManager();

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
      list.push({
        id: `${card.id}-front`,
        cardId: card.id,
        text: card.front_text,
        romanised: card.romanised,
      });
      list.push({
        id: `${card.id}-back`,
        cardId: card.id,
        text: card.back_text,
        romanised: card.romanised,
      });
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
    if (!kidsMode || phase !== "finished" || kidsCompleteRef.current) return;
    kidsCompleteRef.current = true;
    void onKidsComplete?.(pairsMatched);
  }, [kidsMode, phase, pairsMatched, onKidsComplete]);

  useEffect(() => {
    if (kidsMode || phase !== "finished" || savedRef.current) return;
    savedRef.current = true;

    const timeUsed = startedAtRef.current
      ? Math.min(GAME_SECONDS, Math.ceil((Date.now() - startedAtRef.current) / 1000))
      : GAME_SECONDS;
    setElapsedSeconds(timeUsed);

    const persist = async () => {
      setSaveError(null);
      setSaveState("saving");

      try {
        const response = await fetch("/api/games/match-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deckName: deck.deckName,
            score: pairsMatched,
            timeSeconds: timeUsed,
            totalPairs: deck.cards.length,
          }),
        });
        const payload = (await response.json()) as {
          isNewBest?: boolean;
          currentBest?: number;
          saved?: boolean;
          error?: string;
        };

        if (!response.ok || !payload.saved) {
          throw new Error(payload.error ?? "Could not save score");
        }

        setResult({
          isNewBest: Boolean(payload.isNewBest),
          currentBest: payload.currentBest ?? initialBestScore,
        });
        setSaveState("saved");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save score";
        console.error("Match score save failed:", message);
        setSaveState("error");
        setSaveError(
          "We couldn't save this round. Your pairs still count locally — try again soon."
        );
      }
    };

    void persist();
  }, [phase, pairsMatched, deck.deckName, deck.cards.length, initialBestScore]);

  useEffect(() => {
    if (pairsMatched === deck.cards.length && phase === "playing") {
      setPhase("finished");
    }
  }, [pairsMatched, deck.cards.length, phase]);

  function startGame() {
    savedRef.current = false;
    kidsCompleteRef.current = false;
    setTiles(buildTiles());
    setPhase("playing");
    setSecondsLeft(GAME_SECONDS);
    setSelectedTileId(null);
    setMatchedCardIds(new Set());
    setWrongTileId(null);
    setPairsMatched(0);
    setResult(null);
    setSaveError(null);
    setSaveState("idle");
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
      playSound("correct");
      setMatchedCardIds((prev) => new Set(prev).add(tile.cardId));
      setPairsMatched((prev) => prev + 1);
      setSelectedTileId(null);
      return;
    }

    playSound("incorrect");
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
          <div className="flex items-start justify-between gap-3">
            <BackLink fallbackHref={deckHubHref}>← Back</BackLink>
            <GameTutorialHost tutorialId="match" />
          </div>
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
      <MatchFinishedScreen
        challenge={challenge}
        challengeFinish={challengeFinish}
        pairsMatched={pairsMatched}
        deck={deck}
        elapsedSeconds={elapsedSeconds}
        result={result}
        saveError={saveError}
        saveState={saveState}
        initialBestScore={initialBestScore}
        deckHubHref={deckHubHref}
        onPlayAgain={startGame}
        kidsMode={kidsMode}
      />
    );
  }

  return (
    <div className="relative space-y-4">
      {!kidsMode && <FloatingSoundToggle />}
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
              <FlashcardBilingualLine text={tile.text} romanised={tile.romanised} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchFinishedScreen({
  challenge,
  challengeFinish,
  pairsMatched,
  deck,
  elapsedSeconds,
  result,
  saveError,
  saveState,
  initialBestScore,
  deckHubHref,
  onPlayAgain,
  kidsMode,
}: {
  challenge: ChallengePlayContext | null | undefined;
  challengeFinish: ReturnType<typeof useChallengeFinish>;
  pairsMatched: number;
  deck: FlashcardDeckContext;
  elapsedSeconds: number;
  result: { isNewBest: boolean; currentBest: number } | null;
  saveError: string | null;
  saveState: "idle" | "saving" | "saved" | "error";
  initialBestScore: number;
  deckHubHref: string;
  onPlayAgain: () => void;
  kidsMode: boolean;
}) {
  usePlaySoundOnce("game_complete");
  const personalBest = result?.currentBest ?? initialBestScore;

  return (
    <div className="relative space-y-6">
      {!kidsMode && <FloatingSoundToggle />}
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
        {!result?.isNewBest && personalBest > 0 && (
          <p className="mt-3 text-sm text-zinc-500">Personal best: {personalBest} pairs</p>
        )}
        {!kidsMode && saveState === "saving" ? (
          <p className="mt-3 text-sm text-zinc-500">Saving score…</p>
        ) : null}
        {!kidsMode && saveState === "saved" ? (
          <p className="mt-3 text-sm font-medium text-emerald-700">Score saved</p>
        ) : null}
        {saveError ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{saveError}</p>
        ) : null}
      </div>
      {!challenge && (
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Play again
        </button>
      )}
      <BackLink
        fallbackHref={deckHubHref}
        className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back
      </BackLink>
    </div>
  );
}
