"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LaneRunnerCoin, coinLanesForRound, randomCoinLane } from "@/components/games/lane-runner/lane-runner-coin";
import { LaneRunnerGateView } from "@/components/games/lane-runner/lane-runner-gate";
import {
  LaneRunnerHeader,
  LaneRunnerReadyScreen,
} from "@/components/games/lane-runner/lane-runner-header";
import { LaneRunnerLetter } from "@/components/games/lane-runner/lane-runner-letter";
import { LaneRunnerLetterTracker } from "@/components/games/lane-runner/lane-runner-letter-tracker";
import { LaneRunnerRoad } from "@/components/games/lane-runner/lane-runner-road";
import { LaneRunnerRoundEnd } from "@/components/games/lane-runner/lane-runner-round-end";
import { LaneRunnerRunner } from "@/components/games/lane-runner/lane-runner-runner";
import { awardCoins } from "@/lib/coins/balance";
import { saveGameScore } from "@/lib/games/game-scores";
import {
  BASE_COLLECTIBLE_FALL_MS,
  BASE_GATE_FALL_MS,
  COIN_POP_MS,
  COINS_PER_GATE,
  COIN_SPAWN_STAGGER_MS,
  COLLECTIBLE_REMOVE_MS,
  CORRECT_ANSWER_COIN_REWARD,
  GATE_ADVANCE_MS,
  KIDDA_CELEBRATION_MS,
  KIDDA_SPELL_COIN_BONUS,
  LANE_PICKUP_COIN_REWARD,
  LANE_RUNNER_GAME_TYPE,
  LANE_RUNNER_LIVES,
  ROAD_FLASH_MS,
  SWIPE_THRESHOLD_PX,
} from "@/lib/games/lane-runner/config";
import { buildNextLaneRunnerGate } from "@/lib/games/lane-runner/gates";
import {
  createEmptyLetterSlots,
  fillEarliestLetterSlot,
  nextSpawnableLetter,
  randomLetterSpawnDelayMs,
  type KiddaLetter,
  type LetterSlot,
} from "@/lib/games/lane-runner/letter-tracker";
import { fallDurationMs } from "@/lib/games/lane-runner/speed-ramp";
import type {
  ActiveCoin,
  ActiveLetter,
  LaneIndex,
  LaneRunnerFlashcard,
  LaneRunnerGate,
  LaneRunnerGateResult,
  LaneRunnerRoundSummary,
} from "@/lib/games/lane-runner/types";
import { useActivePlayTime } from "@/lib/games/lane-runner/use-active-play-time";
import { buildGameAccuracyMetadata } from "@/lib/leaderboard/points";
import { createClient } from "@/lib/supabase/client";

type Phase = "ready" | "playing" | "gameover";

type LaneRunnerModeProps = {
  cards: LaneRunnerFlashcard[];
  loadError: string | null;
  initialCoinBalance: number;
  learnerLevel: number | null;
};

export function LaneRunnerMode({
  cards,
  loadError,
  initialCoinBalance,
  learnerLevel,
}: LaneRunnerModeProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [currentGate, setCurrentGate] = useState<LaneRunnerGate | null>(null);
  const [gateKey, setGateKey] = useState(0);
  const [gateFallMs, setGateFallMs] = useState(BASE_GATE_FALL_MS);
  const [collectibleFallMs, setCollectibleFallMs] = useState(BASE_COLLECTIBLE_FALL_MS);
  const [gateResults, setGateResults] = useState<LaneRunnerGateResult[]>([]);
  const [playerLane, setPlayerLane] = useState<LaneIndex>(1);
  const [lean, setLean] = useState<"left" | "right" | null>(null);
  const [landing, setLanding] = useState(false);
  const [lives, setLives] = useState(LANE_RUNNER_LIVES);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lifetimeCoins, setLifetimeCoins] = useState(initialCoinBalance);
  const [roundCoinsEarned, setRoundCoinsEarned] = useState(0);
  const [coinPopAmount, setCoinPopAmount] = useState<number | null>(null);
  const [activeCoins, setActiveCoins] = useState<ActiveCoin[]>([]);
  const [activeLetter, setActiveLetter] = useState<ActiveLetter | null>(null);
  const [letterSlots, setLetterSlots] = useState<LetterSlot[]>(createEmptyLetterSlots);
  const [kiddaCelebration, setKiddaCelebration] = useState(false);
  const [roadFlash, setRoadFlash] = useState<"hit" | "miss" | null>(null);
  const [roundSummary, setRoundSummary] = useState<LaneRunnerRoundSummary | null>(null);

  const playAreaRef = useRef<HTMLDivElement>(null);
  const playerLaneRef = useRef<LaneIndex>(1);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const gateResolvingRef = useRef(false);
  const flashTimeoutRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const coinIdRef = useRef(0);
  const letterIdRef = useRef(0);
  const usedFlashcardIdsRef = useRef<Set<string>>(new Set());
  const nextLetterAtRef = useRef(randomLetterSpawnDelayMs());
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const livesRef = useRef(LANE_RUNNER_LIVES);
  const roundCoinsEarnedRef = useRef(0);
  const activePlayMsRef = useRef(0);

  const { activePlayMs, resetActivePlayTime } = useActivePlayTime(phase === "playing");
  const canStart = cards.length >= 3 && !loadError;

  useEffect(() => {
    playerLaneRef.current = playerLane;
  }, [playerLane]);

  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);

  useEffect(() => {
    bestStreakRef.current = bestStreak;
  }, [bestStreak]);

  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  useEffect(() => {
    activePlayMsRef.current = activePlayMs;
  }, [activePlayMs]);

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

  const showCoinPop = useCallback((amount: number) => {
    setCoinPopAmount(amount);
    window.setTimeout(() => setCoinPopAmount(null), COIN_POP_MS);
  }, []);

  const grantCoins = useCallback(
    async (amount: number) => {
      if (amount <= 0) return;
      setLifetimeCoins((balance) => balance + amount);
      setRoundCoinsEarned((earned) => {
        const next = earned + amount;
        roundCoinsEarnedRef.current = next;
        return next;
      });
      showCoinPop(amount);
      const supabase = createClient();
      const updated = await awardCoins(supabase, amount);
      if (updated !== null) setLifetimeCoins(updated);
    },
    [showCoinPop]
  );

  const applyFallSpeed = useCallback(() => {
    const gateMs = fallDurationMs(activePlayMsRef.current, BASE_GATE_FALL_MS);
    const collectibleMs = fallDurationMs(activePlayMsRef.current, BASE_COLLECTIBLE_FALL_MS);
    setGateFallMs(gateMs);
    setCollectibleFallMs(collectibleMs);
  }, []);

  const spawnCoinsForGate = useCallback(() => {
    const lanes = coinLanesForRound(COINS_PER_GATE);
    const coins: ActiveCoin[] = lanes.map((targetLane, index) => {
      coinIdRef.current += 1;
      return {
        id: `coin-${coinIdRef.current}`,
        targetLane,
        status: "falling",
        startDelayMs: index * COIN_SPAWN_STAGGER_MS,
      };
    });
    setActiveCoins(coins);
  }, []);

  const loadNextGate = useCallback(() => {
    applyFallSpeed();
    const gate = buildNextLaneRunnerGate(cards, usedFlashcardIdsRef.current);
    if (!gate) return false;
    usedFlashcardIdsRef.current.add(gate.flashcard_id);
    setCurrentGate(gate);
    setGateKey((key) => key + 1);
    spawnCoinsForGate();
    return true;
  }, [applyFallSpeed, cards, spawnCoinsForGate]);

  const gateResultsRef = useRef<LaneRunnerGateResult[]>([]);

  const finishRound = useCallback((results: LaneRunnerGateResult[]) => {
    const summary: LaneRunnerRoundSummary = {
      finalStreak: streakRef.current,
      bestStreak: bestStreakRef.current,
      coinsEarnedRound: roundCoinsEarnedRef.current,
      gatesAnswered: results.length,
      gatesCorrect: results.filter((result) => result.hit).length,
    };
    setRoundSummary(summary);
    setPhase("gameover");
  }, []);

  const advanceAfterGate = useCallback(
    (result: LaneRunnerGateResult) => {
      gateResultsRef.current = [...gateResultsRef.current, result];
      setGateResults(gateResultsRef.current);

      window.setTimeout(() => {
        gateResolvingRef.current = false;

        if (result.hit) {
          const nextStreak = streakRef.current + 1;
          streakRef.current = nextStreak;
          setStreak(nextStreak);
          setBestStreak((best) => Math.max(best, nextStreak));
          void grantCoins(CORRECT_ANSWER_COIN_REWARD);
          loadNextGate();
          return;
        }

        streakRef.current = 0;
        setStreak(0);
        const nextLives = livesRef.current - 1;
        livesRef.current = nextLives;
        setLives(nextLives);
        if (nextLives <= 0) {
          finishRound(gateResultsRef.current);
          return;
        }

        loadNextGate();
      }, GATE_ADVANCE_MS);
    },
    [finishRound, grantCoins, loadNextGate]
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

  const handleCoinArrive = useCallback(
    (coinId: string) => {
      setActiveCoins((prev) => {
        const coin = prev.find((item) => item.id === coinId);
        if (!coin || coin.status !== "falling") return prev;

        const caught = playerLaneRef.current === coin.targetLane;
        if (caught) void grantCoins(LANE_PICKUP_COIN_REWARD);

        const nextStatus = caught ? "caught" : "missed";
        window.setTimeout(() => {
          setActiveCoins((current) => current.filter((item) => item.id !== coinId));
        }, COLLECTIBLE_REMOVE_MS);

        return prev.map((item) =>
          item.id === coinId ? { ...item, status: nextStatus } : item
        );
      });
    },
    [grantCoins]
  );

  const handleLetterArrive = useCallback(
    (letterId: string) => {
      setActiveLetter((prev) => {
        if (!prev || prev.id !== letterId || prev.status !== "falling") return prev;

        const caught = playerLaneRef.current === prev.targetLane;
        if (caught) {
          setLetterSlots((slots) => {
            const outcome = fillEarliestLetterSlot(slots, prev.letter as KiddaLetter);
            if (!outcome.filled) return slots;
            if (outcome.completed) {
              setKiddaCelebration(true);
              window.setTimeout(() => setKiddaCelebration(false), KIDDA_CELEBRATION_MS);
              void grantCoins(KIDDA_SPELL_COIN_BONUS);
              return createEmptyLetterSlots();
            }
            return outcome.slots;
          });
        }

        const nextStatus = caught ? "caught" : "missed";
        window.setTimeout(() => setActiveLetter(null), COLLECTIBLE_REMOVE_MS);
        return { ...prev, status: nextStatus };
      });
    },
    [grantCoins]
  );

  useEffect(() => {
    if (phase !== "playing" || activeLetter) return;
    const letter = nextSpawnableLetter(letterSlots);
    if (!letter) return;
    if (activePlayMs < nextLetterAtRef.current) return;

    letterIdRef.current += 1;
    setActiveLetter({
      id: `letter-${letterIdRef.current}`,
      letter,
      targetLane: randomCoinLane(),
      status: "falling",
    });
    nextLetterAtRef.current = activePlayMs + randomLetterSpawnDelayMs();
  }, [activePlayMs, activeLetter, letterSlots, phase]);

  useEffect(() => {
    if (phase !== "gameover" || savedRef.current || !roundSummary) return;
    const userId = userIdRef.current;
    if (!userId) return;

    savedRef.current = true;
    const { gatesCorrect, gatesAnswered, bestStreak: best } = roundSummary;
    const meta = {
      ...buildGameAccuracyMetadata(gatesCorrect, gatesAnswered),
      best_streak: best,
      coins_earned_round: roundSummary.coinsEarnedRound,
      endless: true,
    };

    void (async () => {
      const supabase = createClient();
      await saveGameScore(supabase, userId, LANE_RUNNER_GAME_TYPE, best, meta);
    })().catch(console.error);
  }, [phase, roundSummary]);

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
      if (dx > dy && dx > 8) event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      const dx = event.changedTouches[0].clientX - touchStartRef.current.x;
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) moveLane(dx < 0 ? -1 : 1);
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

  function resetRoundState() {
    usedFlashcardIdsRef.current = new Set();
    gateResultsRef.current = [];
    setGateResults([]);
    setPlayerLane(1);
    setLives(LANE_RUNNER_LIVES);
    setStreak(0);
    setBestStreak(0);
    setRoundCoinsEarned(0);
    roundCoinsEarnedRef.current = 0;
    setActiveCoins([]);
    setActiveLetter(null);
    setLetterSlots(createEmptyLetterSlots());
    setRoadFlash(null);
    setKiddaCelebration(false);
    setCurrentGate(null);
    gateResolvingRef.current = false;
    coinIdRef.current = 0;
    letterIdRef.current = 0;
    nextLetterAtRef.current = randomLetterSpawnDelayMs();
    resetActivePlayTime();
    savedRef.current = false;
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
  }

  function handleStart() {
    resetRoundState();
    setPhase("playing");
    loadNextGate();
  }

  function handlePlayAgain() {
    resetRoundState();
    setRoundSummary(null);
    setPhase("playing");
    loadNextGate();
  }

  if (phase === "ready") {
    return (
      <LaneRunnerReadyScreen canStart={canStart} loadError={loadError} onStart={handleStart} />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <LaneRunnerHeader
        lives={lives}
        lifetimeCoins={lifetimeCoins}
        streak={streak}
        learnerLevel={learnerLevel}
        coinPopAmount={coinPopAmount}
      />

      <LaneRunnerLetterTracker slots={letterSlots} />

      {kiddaCelebration ? (
        <div className="lane-runner-kidda-celebration pointer-events-none rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-center">
          <p className="text-sm font-bold text-violet-800">KIDDA spelled! +{KIDDA_SPELL_COIN_BONUS} coins</p>
        </div>
      ) : null}

      <p className="text-center text-lg font-bold text-zinc-900">{currentGate?.prompt ?? ""}</p>

      <div
        ref={playAreaRef}
        className="relative flex min-h-[28rem] flex-1 touch-none flex-col"
        style={{ touchAction: "pan-y" }}
      >
        <LaneRunnerRoad flash={roadFlash}>
          {activeCoins.map((coin) => (
            <LaneRunnerCoin
              key={coin.id}
              coin={coin}
              fallDurationMs={collectibleFallMs}
              onArrive={handleCoinArrive}
            />
          ))}

          {activeLetter ? (
            <LaneRunnerLetter
              key={activeLetter.id}
              letter={activeLetter}
              fallDurationMs={collectibleFallMs}
              onArrive={handleLetterArrive}
            />
          ) : null}

          {currentGate ? (
            <LaneRunnerGateView
              gate={currentGate}
              gateKey={gateKey}
              fallDurationMs={gateFallMs}
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

      {phase === "gameover" && roundSummary ? (
        <LaneRunnerRoundEnd summary={roundSummary} onPlayAgain={handlePlayAgain} />
      ) : null}
    </div>
  );
}
