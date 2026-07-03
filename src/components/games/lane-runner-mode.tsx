"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GameSessionReview } from "@/components/games/game-session-review";
import { GameSessionSettings } from "@/components/games/game-session-settings";
import { LaneRunnerCoin, randomCoinLane } from "@/components/games/lane-runner/lane-runner-coin";
import { LaneRunnerGateView } from "@/components/games/lane-runner/lane-runner-gate";
import { LaneRunnerRoad } from "@/components/games/lane-runner/lane-runner-road";
import { LaneRunnerRunner } from "@/components/games/lane-runner/lane-runner-runner";
import { SessionProgressBar } from "@/components/session-progress-bar";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { saveGameScore } from "@/lib/games/game-scores";
import {
  LANE_RUNNER_DISPLAY_NAME,
  LANE_RUNNER_GAME_TYPE,
  ROAD_FLASH_MS,
  SWIPE_THRESHOLD_PX,
} from "@/lib/games/lane-runner/config";
import { buildLaneRunnerRound } from "@/lib/games/lane-runner/gates";
import type {
  ActiveCoin,
  LaneIndex,
  LaneRunnerFlashcard,
  LaneRunnerGate,
  LaneRunnerGateResult,
} from "@/lib/games/lane-runner/types";
import type { GameSessionSettingsChoice } from "@/lib/games/session-settings";
import { createClient } from "@/lib/supabase/client";

const COIN_REMOVE_MS = 500;
const COIN_POP_MS = 550;
const GATE_ADVANCE_MS = 320;

type Phase = "setup" | "playing" | "finished";

type LaneRunnerModeProps = {
  cards: LaneRunnerFlashcard[];
  loadError: string | null;
};

export function LaneRunnerMode({ cards, loadError }: LaneRunnerModeProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [gates, setGates] = useState<LaneRunnerGate[]>([]);
  const [gateIndex, setGateIndex] = useState(0);
  const [gateKey, setGateKey] = useState(0);
  const [gateResults, setGateResults] = useState<LaneRunnerGateResult[]>([]);
  const [playerLane, setPlayerLane] = useState<LaneIndex>(1);
  const [lean, setLean] = useState<"left" | "right" | null>(null);
  const [landing, setLanding] = useState(false);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [activeCoins, setActiveCoins] = useState<ActiveCoin[]>([]);
  const [roadFlash, setRoadFlash] = useState<"hit" | "miss" | null>(null);
  const [coinPop, setCoinPop] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  const playAreaRef = useRef<HTMLDivElement>(null);
  const playerLaneRef = useRef<LaneIndex>(1);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const gateResolvingRef = useRef(false);
  const flashTimeoutRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const coinIdRef = useRef(0);

  const canStart = cards.length >= 3 && !loadError;
  const currentGate = gates[gateIndex] ?? null;
  const correctCount = gateResults.filter((result) => result.hit).length;

  useEffect(() => {
    playerLaneRef.current = playerLane;
  }, [playerLane]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const triggerRoadFlash = useCallback((type: "hit" | "miss") => {
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
    setRoadFlash(type);
    flashTimeoutRef.current = window.setTimeout(() => {
      setRoadFlash(null);
      flashTimeoutRef.current = null;
    }, ROAD_FLASH_MS);
  }, []);

  const moveLane = useCallback((direction: -1 | 1) => {
    setPlayerLane((current) => {
      const next = Math.max(0, Math.min(2, current + direction)) as LaneIndex;
      if (next === current) return current;
      setLean(direction < 0 ? "left" : "right");
      window.setTimeout(() => {
        setLean(null);
        setLanding(true);
        window.setTimeout(() => setLanding(false), 220);
      }, 280);
      return next;
    });
  }, []);

  useEffect(() => {
    const element = playAreaRef.current;
    if (!element || phase !== "playing") return;

    const onTouchStart = (event: TouchEvent) => {
      touchStartRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const dx = Math.abs(event.touches[0].clientX - touchStartRef.current.x);
      const dy = Math.abs(event.touches[0].clientY - touchStartRef.current.y);
      if (dx > dy && dx > 8) {
        event.preventDefault();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      const dx = event.changedTouches[0].clientX - touchStartRef.current.x;
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
        moveLane(dx < 0 ? -1 : 1);
      }
    };

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
    };
  }, [phase, moveLane]);

  useEffect(() => {
    if (phase !== "playing") return;

    coinIdRef.current += 1;
    const coin: ActiveCoin = {
      id: `coin-${coinIdRef.current}`,
      targetLane: randomCoinLane(),
      status: "falling",
    };
    setActiveCoins([coin]);
  }, [phase, gateKey]);

  const handleCoinArrive = useCallback((coinId: string) => {
    setActiveCoins((prev) => {
      const coin = prev.find((item) => item.id === coinId);
      if (!coin || coin.status !== "falling") return prev;

      const caught = playerLaneRef.current === coin.targetLane;
      if (caught) {
        setCoinsCollected((count) => count + 1);
        setCoinPop(true);
        window.setTimeout(() => setCoinPop(false), COIN_POP_MS);
      }

      const nextStatus: ActiveCoin["status"] = caught ? "caught" : "missed";
      window.setTimeout(() => {
        setActiveCoins((current) => current.filter((item) => item.id !== coinId));
      }, COIN_REMOVE_MS);

      return prev.map((item) =>
        item.id === coinId ? { ...item, status: nextStatus } : item
      );
    });
  }, []);

  const advanceAfterGate = useCallback(
    (result: LaneRunnerGateResult) => {
      setGateResults((prev) => [...prev, result]);

      window.setTimeout(() => {
        gateResolvingRef.current = false;
        setGateIndex((idx) => {
          const nextIndex = idx + 1;
          if (nextIndex >= gates.length) {
            setPhase("finished");
            return idx;
          }
          setGateKey((key) => key + 1);
          return nextIndex;
        });
      }, GATE_ADVANCE_MS);
    },
    [gates.length]
  );

  const handleGateArrive = useCallback(() => {
    if (!currentGate || gateResolvingRef.current) return;
    gateResolvingRef.current = true;

    const selectedLane = playerLaneRef.current;
    const hit = selectedLane === currentGate.correctLane;
    triggerRoadFlash(hit ? "hit" : "miss");

    const result: LaneRunnerGateResult = {
      flashcard_id: currentGate.flashcard_id,
      correct_lane: currentGate.correctLane,
      selected_lane: selectedLane,
      hit,
    };

    advanceAfterGate(result);
  }, [advanceAfterGate, currentGate, triggerRoadFlash]);

  useEffect(() => {
    if (phase !== "finished" || savedRef.current) return;
    const userId = userIdRef.current;
    if (!userId || gates.length === 0) return;

    savedRef.current = true;
    const correct = gateResults.filter((result) => result.hit).length;
    const total = gates.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const persist = async () => {
      const supabase = createClient();
      const outcome = await saveGameScore(supabase, userId, LANE_RUNNER_GAME_TYPE, correct, {
        accuracy,
        correct,
        total,
        gate_count: total,
        coins_collected: coinsCollected,
        gates: gateResults,
      });
      setPointsEarned(outcome.pointsEarned);
    };

    void persist();
  }, [phase, gates.length, gateResults, coinsCollected]);

  function handleStart(choice: GameSessionSettingsChoice) {
    const round = buildLaneRunnerRound(cards, choice.questionCount);
    if (round.length === 0) return;

    savedRef.current = false;
    setGates(round);
    setGateIndex(0);
    setGateKey(0);
    setGateResults([]);
    setPlayerLane(1);
    setCoinsCollected(0);
    setActiveCoins([]);
    setRoadFlash(null);
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    gateResolvingRef.current = false;
    coinIdRef.current = 0;
    setPhase("playing");
  }

  function handlePlayAgain() {
    setPhase("setup");
    setGates([]);
    setGateResults([]);
    setPointsEarned(0);
    savedRef.current = false;
  }

  if (phase === "setup") {
    return (
      <GameSessionSettings
        gameTitle={LANE_RUNNER_DISPLAY_NAME}
        gameDescription="Run the road — dodge into the right lane before each question gate arrives, and grab coins along the way."
        filterLabel="Card pool"
        filterOptions={[{ id: "all", label: "All flashcards" }]}
        poolSizeForFilter={() => cards.length}
        repeatUnit="sentence"
        repeatPolicy="cycle"
        canStart={canStart}
        unavailableMessage={
          loadError ? (
            <p className="text-sm text-red-600">Could not load flashcards: {loadError}</p>
          ) : cards.length < 3 ? (
            <p className="text-sm text-amber-700">
              Need at least 3 flashcards with distinct front and back text to play.
            </p>
          ) : undefined
        }
        onStart={handleStart}
      />
    );
  }

  if (phase === "finished") {
    const total = gates.length;
    const sessionLog = gateResults.map((result, index) => {
      const selected = gates[index]?.laneAnswers[result.selected_lane];
      const correct = gates[index]?.laneAnswers[result.correct_lane];
      return {
        prompt: gates[index]?.prompt ?? "",
        userAnswer: selected?.gurmukhi ?? "",
        userAnswerRomanised: selected?.romanised,
        correctAnswer: correct?.gurmukhi ?? "",
        correctAnswerRomanised: correct?.romanised,
        wasCorrect: result.hit,
      };
    });

    return (
      <GameSessionReview
        title={LANE_RUNNER_DISPLAY_NAME}
        correct={correctCount}
        total={total}
        sessionLog={sessionLog}
        pointsEarned={pointsEarned}
        scoreSubtitle={`${coinsCollected} coin${coinsCollected === 1 ? "" : "s"} collected`}
        onPlayAgain={handlePlayAgain}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Games
        </Link>
        <div className="relative flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
          <span aria-hidden>○</span>
          <span>{coinsCollected}</span>
          {coinPop ? (
            <span className="lane-runner-coin-pop absolute -top-4 right-0 text-xs font-bold text-amber-700">
              +1
            </span>
          ) : null}
        </div>
      </div>

      <SessionProgressBar current={gateIndex + 1} total={gates.length} />

      <p className="text-center text-lg font-bold text-zinc-900">
        {currentGate?.prompt ?? ""}
      </p>

      <div
        ref={playAreaRef}
        className="relative flex min-h-0 flex-1 touch-none flex-col"
        style={{ touchAction: "pan-y" }}
      >
        <LaneRunnerRoad flash={roadFlash}>
          {activeCoins.map((coin) => (
            <LaneRunnerCoin key={coin.id} coin={coin} onArrive={handleCoinArrive} />
          ))}

          {currentGate ? (
            <LaneRunnerGateView
              gate={currentGate}
              gateKey={gateKey}
              onArrive={handleGateArrive}
            />
          ) : null}

          <LaneRunnerRunner lane={playerLane} lean={lean} landing={landing} />
        </LaneRunnerRoad>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => moveLane(-1)}
          className="rounded-xl border-2 border-violet-600 bg-white py-3 text-sm font-semibold text-violet-700"
        >
          ← Left
        </button>
        <button
          type="button"
          onClick={() => moveLane(1)}
          className="rounded-xl border-2 border-violet-600 bg-white py-3 text-sm font-semibold text-violet-700"
        >
          Right →
        </button>
      </div>

      <p className="text-center text-xs text-zinc-500">
        Swipe left or right on the road, or use the buttons.
      </p>
    </div>
  );
}
