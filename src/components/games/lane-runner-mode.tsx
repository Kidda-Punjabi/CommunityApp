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
  CollectibleStatus,
  LaneIndex,
  LaneRunnerFlashcard,
  LaneRunnerGate,
  LaneRunnerGateResult,
  LaneRunnerRoundSummary,
  QueuedLaneRunnerGate,
  LaneRunnerRoadBeat,
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
  const [gateQueue, setGateQueue] = useState<QueuedLaneRunnerGate[]>([]);
  const [roadBeat, setRoadBeat] = useState<LaneRunnerRoadBeat>("collectibles");
  const [activeCoins, setActiveCoins] = useState<ActiveCoin[]>([]);
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
  const gateIdRef = useRef(0);
  const gateQueueRef = useRef<QueuedLaneRunnerGate[]>([]);
  const pendingGateArrivalRef = useRef<string | null>(null);
  const roadBeatRef = useRef<LaneRunnerRoadBeat>("collectibles");
  const letterSlotsRef = useRef<LetterSlot[]>(createEmptyLetterSlots());
  const letterIdRef = useRef(0);
  const usedFlashcardIdsRef = useRef<Set<string>>(new Set());
  const nextLetterAtRef = useRef(randomLetterSpawnDelayMs());
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const livesRef = useRef(LANE_RUNNER_LIVES);
  const roundCoinsEarnedRef = useRef(0);
  const activePlayMsRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");

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
    gateQueueRef.current = gateQueue;
  }, [gateQueue]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    roadBeatRef.current = roadBeat;
  }, [roadBeat]);

  useEffect(() => {
    letterSlotsRef.current = letterSlots;
  }, [letterSlots]);

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

  const spawnCoinsForBeat = useCallback((): ActiveCoin[] => {
    const lanes = coinLanesForRound(COINS_PER_GATE);
    return lanes.map((targetLane, index) => {
      coinIdRef.current += 1;
      return {
        id: `coin-${coinIdRef.current}`,
        targetLane,
        status: "falling",
        startDelayMs: index * COIN_SPAWN_STAGGER_MS,
      };
    });
  }, []);

  const applyFallSpeed = useCallback(() => {
    const gateMs = fallDurationMs(activePlayMsRef.current, BASE_GATE_FALL_MS);
    const collectibleMs = fallDurationMs(activePlayMsRef.current, BASE_COLLECTIBLE_FALL_MS);
    setCollectibleFallMs(collectibleMs);
    return { gateMs, collectibleMs };
  }, []);

  const finishCollectibleBeatRef = useRef<() => void>(() => {});

  const finishCollectibleBeat = useCallback(() => {
    setActiveCoins([]);
    setActiveLetter(null);
    setRoadBeat("answering");
  }, []);

  useEffect(() => {
    finishCollectibleBeatRef.current = finishCollectibleBeat;
  }, [finishCollectibleBeat]);

  const startCollectibleBeat = useCallback(() => {
    if (phaseRef.current !== "playing") return;

    applyFallSpeed();
    setRoadBeat("collectibles");

    const letter = nextSpawnableLetter(letterSlotsRef.current);
    if (letter && activePlayMsRef.current >= nextLetterAtRef.current) {
      letterIdRef.current += 1;
      setActiveLetter({
        id: `letter-${letterIdRef.current}`,
        letter,
        targetLane: randomCoinLane(),
        status: "falling",
      });
      nextLetterAtRef.current = activePlayMsRef.current + randomLetterSpawnDelayMs();
      return;
    }

    setActiveCoins(spawnCoinsForBeat());
  }, [applyFallSpeed, spawnCoinsForBeat]);

  const enqueueGate = useCallback(() => {
    const { gateMs } = applyFallSpeed();
    const gate = buildNextLaneRunnerGate(cards, usedFlashcardIdsRef.current);
    if (!gate) return false;

    usedFlashcardIdsRef.current.add(gate.flashcard_id);
    gateIdRef.current += 1;

    const queued: QueuedLaneRunnerGate = {
      id: `gate-${gateIdRef.current}`,
      renderKey: gateIdRef.current,
      gate,
      fallDurationMs: gateMs,
    };

    setGateQueue((prev) => {
      const next = [...prev, queued];
      gateQueueRef.current = next;
      return next;
    });
    return true;
  }, [applyFallSpeed, cards]);

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
    (result: LaneRunnerGateResult, gateId: string) => {
      gateResultsRef.current = [...gateResultsRef.current, result];
      setGateResults(gateResultsRef.current);

      window.setTimeout(() => {
        setGateQueue((prev) => {
          const next = prev.filter((queued) => queued.id !== gateId);
          gateQueueRef.current = next;
          return next;
        });
        gateResolvingRef.current = false;

        if (result.hit) {
          const nextStreak = streakRef.current + 1;
          streakRef.current = nextStreak;
          setStreak(nextStreak);
          setBestStreak((best) => Math.max(best, nextStreak));
          void grantCoins(CORRECT_ANSWER_COIN_REWARD);
        } else {
          streakRef.current = 0;
          setStreak(0);
          const nextLives = livesRef.current - 1;
          livesRef.current = nextLives;
          setLives(nextLives);
          if (nextLives <= 0) {
            finishRound(gateResultsRef.current);
            return;
          }
        }

        const pending = pendingGateArrivalRef.current;
        const nextHead = gateQueueRef.current[0];
        if (pending && nextHead?.id === pending) {
          pendingGateArrivalRef.current = null;
          window.requestAnimationFrame(() => {
            resolveGateArrivalRef.current(pending);
          });
          return;
        }

        if (phaseRef.current === "playing" && livesRef.current > 0) {
          startCollectibleBeatRef.current();
        }
      }, GATE_ADVANCE_MS);
    },
    [finishRound, grantCoins]
  );

  const startCollectibleBeatRef = useRef<() => void>(() => {});

  useEffect(() => {
    startCollectibleBeatRef.current = startCollectibleBeat;
  }, [startCollectibleBeat]);

  const resolveGateArrivalRef = useRef<(gateId: string) => void>(() => {});

  const resolveGateArrival = useCallback(
    (gateId: string) => {
      const head = gateQueueRef.current[0];
      if (!head || head.id !== gateId) {
        pendingGateArrivalRef.current = gateId;
        return;
      }
      if (gateResolvingRef.current) {
        pendingGateArrivalRef.current = gateId;
        return;
      }

      pendingGateArrivalRef.current = null;
      gateResolvingRef.current = true;

      const selectedLane = playerLaneRef.current;
      const hit = selectedLane === head.gate.correctLane;
      triggerRoadFlash(hit ? "hit" : "miss");

      const result: LaneRunnerGateResult = {
        flashcard_id: head.gate.flashcard_id,
        correct_lane: head.gate.correctLane,
        selected_lane: selectedLane,
        hit,
      };

      advanceAfterGate(result, gateId);
    },
    [advanceAfterGate, triggerRoadFlash]
  );

  useEffect(() => {
    resolveGateArrivalRef.current = resolveGateArrival;
  }, [resolveGateArrival]);

  const handleGateFallStart = useCallback(
    (gateId: string) => {
      if (phaseRef.current !== "playing") return;
      const queue = gateQueueRef.current;
      const index = queue.findIndex((queued) => queued.id === gateId);
      if (index === -1 || index !== queue.length - 1) return;
      enqueueGate();
    },
    [enqueueGate]
  );

  const handleGateArrive = useCallback((gateId: string) => {
    resolveGateArrivalRef.current(gateId);
  }, []);

  const handleCoinArrive = useCallback(
    (coinId: string) => {
      setActiveCoins((prev) => {
        const coin = prev.find((item) => item.id === coinId);
        if (!coin || coin.status !== "falling") return prev;

        const caught = playerLaneRef.current === coin.targetLane;
        if (caught) void grantCoins(LANE_PICKUP_COIN_REWARD);

        const nextStatus: CollectibleStatus = caught ? "caught" : "missed";
        const next = prev.map((item) =>
          item.id === coinId ? { ...item, status: nextStatus } : item
        );

        const allResolved = next.every((item) => item.status !== "falling");
        if (allResolved && roadBeatRef.current === "collectibles") {
          window.setTimeout(() => {
            finishCollectibleBeatRef.current();
          }, COLLECTIBLE_REMOVE_MS);
        }

        return next;
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

        const nextStatus: CollectibleStatus = caught ? "caught" : "missed";
        if (roadBeatRef.current === "collectibles") {
          window.setTimeout(() => {
            finishCollectibleBeatRef.current();
          }, COLLECTIBLE_REMOVE_MS);
        }

        return { ...prev, status: nextStatus };
      });
    },
    [grantCoins]
  );

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
    setActiveLetter(null);
    setLetterSlots(createEmptyLetterSlots());
    setRoadFlash(null);
    setKiddaCelebration(false);
    setGateQueue([]);
    gateQueueRef.current = [];
    setRoadBeat("collectibles");
    setActiveCoins([]);
    pendingGateArrivalRef.current = null;
    gateResolvingRef.current = false;
    coinIdRef.current = 0;
    gateIdRef.current = 0;
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
    enqueueGate();
    startCollectibleBeat();
  }

  function handlePlayAgain() {
    resetRoundState();
    setRoundSummary(null);
    setPhase("playing");
    enqueueGate();
    startCollectibleBeat();
  }

  const currentPromptGate = gateQueue[0]?.gate ?? null;
  const showAnswerPrompt = roadBeat === "answering";

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

      <p className="text-center text-lg font-bold text-zinc-900">
        {showAnswerPrompt
          ? (currentPromptGate?.prompt ?? "")
          : activeLetter
            ? "Catch the KIDDA letter!"
            : "Collect the coins!"}
      </p>

      <div
        ref={playAreaRef}
        className="relative flex min-h-[28rem] flex-1 touch-none flex-col"
        style={{ touchAction: "pan-y" }}
      >
        <LaneRunnerRoad flash={roadFlash}>
          {roadBeat === "collectibles" && activeLetter ? (
            <LaneRunnerLetter
              key={activeLetter.id}
              letter={activeLetter}
              fallDurationMs={collectibleFallMs}
              onArrive={handleLetterArrive}
            />
          ) : null}

          {roadBeat === "collectibles"
            ? activeCoins.map((coin) => (
                <LaneRunnerCoin
                  key={coin.id}
                  coin={coin}
                  fallDurationMs={collectibleFallMs}
                  onArrive={handleCoinArrive}
                />
              ))
            : null}

          {roadBeat === "answering"
            ? gateQueue.map((queued, index) => (
                <LaneRunnerGateView
                  key={queued.id}
                  gate={queued.gate}
                  gateKey={queued.renderKey}
                  fallDurationMs={queued.fallDurationMs}
                  canFall={index === 0}
                  onArrive={() => handleGateArrive(queued.id)}
                  onFallStart={() => handleGateFallStart(queued.id)}
                />
              ))
            : null}

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
