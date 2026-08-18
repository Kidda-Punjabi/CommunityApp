"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  claimBuzzIn,
  recoverStuckBuzzInRound,
  resolveBuzzInTimeout,
  submitBuzzInAnswer,
} from "@/app/dashboard/group-games/buzz-in-actions";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { BuzzRacePanel } from "@/components/group-games/buzz-race-panel";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { GroupGameScoreboard } from "@/components/group-games/group-game-scoreboard";
import { useBuzzInRealtime } from "@/hooks/use-buzz-in-realtime";
import { useBuzzRaceTimeout } from "@/hooks/use-buzz-race-timeout";
import { BUZZ_IN_POINTS_PER_CORRECT } from "@/lib/buzz-in/constants";
import type { BuzzInGameState, BuzzInRoundRow } from "@/lib/buzz-in/types";
import {
  BUZZ_RACE_ANSWER_WINDOW_MS,
  BUZZ_RACE_BUZZ_WINDOW_MS,
  BUZZ_RACE_RESULT_DELAY_MS,
} from "@/lib/group-games/buzz-race-constants";
import { deriveBuzzRacePhase, type BuzzRacePhase } from "@/lib/group-games/buzz-race-types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

type BuzzInArenaProps = {
  initialState: BuzzInGameState;
  initialRoom: GameRoomRow;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function roundWindowElapsed(round: BuzzInRoundRow): boolean {
  if (!round.opened_at || round.resolved_at) return false;
  if (round.buzzed_by && round.buzzed_at) {
    return Date.now() >= new Date(round.buzzed_at).getTime() + BUZZ_RACE_ANSWER_WINDOW_MS;
  }
  return Date.now() >= new Date(round.opened_at).getTime() + BUZZ_RACE_BUZZ_WINDOW_MS;
}

export function BuzzInArena({ initialState, initialRoom }: BuzzInArenaProps) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [round, setRound] = useState<BuzzInRoundRow | null>(initialState.currentRound);
  const [phase, setPhase] = useState<BuzzRacePhase>(() =>
    deriveBuzzRacePhase(initialState.currentRound, initialRoom.status)
  );
  const [buzzerName, setBuzzerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [stuckVisible, setStuckVisible] = useState(false);
  const resultTimerRef = useRef<number | null>(null);
  const resultRoundIdRef = useRef<string | null>(null);
  const roundRef = useRef<BuzzInRoundRow | null>(initialState.currentRound);
  const roomRef = useRef(initialRoom);
  const loadCurrentRoundRef = useRef<(completedRoundNumber?: number) => Promise<void>>(
    async () => undefined
  );

  const { currentUserId, isPlaying } = state;
  const isHost = room.host_id === currentUserId;
  const isBuzzer = round?.buzzed_by === currentUserId;
  const question = round?.question_payload;

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const refreshScoreboard = useCallback(async () => {
    const supabase = createClient();
    const { data: participants } = await supabase
      .from("game_room_participants")
      .select("user_id, score, is_playing, is_host")
      .eq("room_id", room.id)
      .is("left_at", null)
      .order("score", { ascending: false });

    if (!participants?.length) return;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in(
        "id",
        participants.map((p) => p.user_id)
      );

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, getDisplayName(p) ?? "Player"])
    );

    setState((prev) => ({
      ...prev,
      scoreboard: participants.map((p) => ({
        userId: p.user_id,
        displayName: profileMap.get(p.user_id) ?? "Player",
        score: p.score,
        isPlaying: p.is_playing,
        isHost: p.is_host,
      })),
    }));
  }, [room.id]);

  const loadBuzzerName = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("full_name, preferred_name")
      .eq("id", userId)
      .maybeSingle();
    setBuzzerName(getDisplayName(data) ?? "Someone");
  }, []);

  const applyRound = useCallback(
    (next: BuzzInRoundRow) => {
      setRound(next);
      setState((prev) => ({ ...prev, currentRoundNumber: next.round_number }));
      setPhase(deriveBuzzRacePhase(next, roomRef.current.status));

      if (next.buzzed_by) void loadBuzzerName(next.buzzed_by);
      else setBuzzerName(null);

      if (next.resolved_at) {
        void refreshScoreboard();
        if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
        resultRoundIdRef.current = next.id;
        const completedNumber = next.round_number;
        resultTimerRef.current = window.setTimeout(() => {
          resultTimerRef.current = null;
          if (resultRoundIdRef.current !== next.id) return;
          resultRoundIdRef.current = null;
          void loadCurrentRoundRef.current(completedNumber);
        }, BUZZ_RACE_RESULT_DELAY_MS);
        return;
      }

      if (resultTimerRef.current && resultRoundIdRef.current !== next.id) {
        window.clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
        resultRoundIdRef.current = null;
      }
    },
    [loadBuzzerName, refreshScoreboard]
  );

  const fetchRoundByNumber = useCallback(
    async (roundNumber: number) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("game_room_rounds")
        .select("*")
        .eq("room_id", room.id)
        .eq("round_number", roundNumber)
        .maybeSingle();

      if (data) applyRound(data as BuzzInRoundRow);
    },
    [applyRound, room.id]
  );

  const loadCurrentRoundFromServer = useCallback(
    async (completedRoundNumber?: number) => {
      const supabase = createClient();
      const { data: roomRow } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("id", room.id)
        .maybeSingle();

      if (!roomRow) return;

      const nextRoom = roomRow as GameRoomRow;
      setRoom(nextRoom);
      setState((prev) => ({
        ...prev,
        roomStatus: nextRoom.status as BuzzInGameState["roomStatus"],
        currentRoundNumber:
          typeof nextRoom.settings?.current_round === "number"
            ? nextRoom.settings.current_round
            : prev.currentRoundNumber,
      }));

      if (nextRoom.status === "lobby") {
        router.push(`/dashboard/group-games/room/${nextRoom.id}`);
        return;
      }

      if (nextRoom.status === "completed") {
        setPhase("finished");
        void refreshScoreboard();
        return;
      }

      const nextRoundNumber =
        typeof nextRoom.settings?.current_round === "number"
          ? nextRoom.settings.current_round
          : (completedRoundNumber ?? 0) + 1;

      await fetchRoundByNumber(nextRoundNumber);
    },
    [fetchRoundByNumber, refreshScoreboard, room.id, router]
  );

  const handleRoomChange = useCallback(
    (next: GameRoomRow) => {
      if (resultRoundIdRef.current) {
        setRoom(next);
        return;
      }

      const prevRoundNumber =
        typeof roomRef.current.settings?.current_round === "number"
          ? roomRef.current.settings.current_round
          : null;
      const nextRoundNumber =
        typeof next.settings?.current_round === "number" ? next.settings.current_round : null;

      setRoom(next);
      setState((prev) => ({
        ...prev,
        roomStatus: next.status as BuzzInGameState["roomStatus"],
        currentRoundNumber: nextRoundNumber ?? prev.currentRoundNumber,
      }));

      if (next.status === "lobby") {
        router.push(`/dashboard/group-games/room/${next.id}`);
        return;
      }

      if (next.status === "completed") {
        setPhase("finished");
        void refreshScoreboard();
        return;
      }

      if (nextRoundNumber !== null && nextRoundNumber !== prevRoundNumber) {
        void fetchRoundByNumber(nextRoundNumber);
      }
    },
    [fetchRoundByNumber, refreshScoreboard, router]
  );

  const handleRoundChange = useCallback(
    (next: BuzzInRoundRow) => {
      if (next.room_id !== room.id) return;
      if (resultRoundIdRef.current && next.id !== resultRoundIdRef.current) {
        return;
      }
      if (roundRef.current?.id === next.id || (next.opened_at && !next.resolved_at)) {
        applyRound(next);
      }
    },
    [applyRound, room.id]
  );

  useEffect(() => {
    loadCurrentRoundRef.current = loadCurrentRoundFromServer;
  }, [loadCurrentRoundFromServer]);

  const handleResync = useCallback(() => {
    if (resultRoundIdRef.current) return;
    void loadCurrentRoundFromServer();
  }, [loadCurrentRoundFromServer]);

  useBuzzInRealtime({
    roomId: room.id,
    onRoomChange: handleRoomChange,
    onRoundChange: handleRoundChange,
    onParticipantsChange: refreshScoreboard,
    onResync: handleResync,
  });

  const handleTimeout = useCallback(async (roundId: string) => {
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      const result = await resolveBuzzInTimeout(roundId);
      if (result.tooEarly) {
        await sleep(400);
        continue;
      }
      if (result.error) {
        await sleep(800);
        continue;
      }
      return;
    }
  }, []);

  useBuzzRaceTimeout({
    itemId: round?.id ?? null,
    openedAt: round?.opened_at ?? null,
    buzzedAt: round?.buzzed_at ?? null,
    buzzedBy: round?.buzzed_by ?? null,
    resolvedAt: round?.resolved_at ?? null,
    enabled: Boolean(round?.opened_at && !round?.resolved_at && phase !== "finished"),
    onTimeout: handleTimeout,
  });

  useEffect(() => {
    if (!round?.opened_at || round.resolved_at || phase === "finished") {
      setStuckVisible(false);
      return;
    }

    const tick = () => {
      const current = roundRef.current;
      if (!current || current.resolved_at) return;
      if (roundWindowElapsed(current)) {
        void resolveBuzzInTimeout(current.id);
        setStuckVisible(true);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [phase, round?.id, round?.opened_at, round?.buzzed_at, round?.buzzed_by, round?.resolved_at]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadCurrentRoundFromServer();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadCurrentRoundFromServer]);

  useEffect(() => {
    return () => {
      if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
    };
  }, []);

  const handleBuzz = () => {
    if (!round || !isPlaying || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await claimBuzzIn(round.id);
      if (result.error) setError(result.error);
      else if (!result.claimed && result.buzzedBy) void loadBuzzerName(result.buzzedBy);
    });
  };

  const handleAnswer = (answer: string) => {
    if (!round || !isBuzzer || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitBuzzInAnswer(round.id, answer);
      if (result.error) setError(result.error);
    });
  };

  const handleRecoverStuckRound = () => {
    if (!round || !isHost || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await recoverStuckBuzzInRound(round.id);
      if (result.tooEarly) setError(result.error ?? "Round is still in progress.");
      else if (result.error) setError(result.error);
      else void loadCurrentRoundFromServer(round.round_number);
    });
  };

  const buzzerDisplayName =
    buzzerName ??
    state.scoreboard.find((entry) => entry.userId === round?.buzzed_by)?.displayName ??
    "Someone";

  const finished = phase === "finished" || room.status === "completed";
  const loading = !finished && (!round || phase === "waiting" || !question);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Buzz-in</p>
          <h1 className="text-lg font-bold text-zinc-900">
            {finished
              ? "Game over"
              : round
                ? `Question ${round.round_number} of ${state.totalRounds}`
                : "Get ready"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {!finished ? (
            <p className="text-xs font-medium text-zinc-500">
              +{BUZZ_IN_POINTS_PER_CORRECT} per correct
            </p>
          ) : null}
          <GameTutorialHost tutorialId="buzz_in" />
        </div>
      </div>

      {finished ? (
        <GroupGameLeaderboard
          title="Buzz-in"
          entries={state.scoreboard}
          currentUserId={currentUserId}
          roomId={room.id}
          isHost={isHost}
          currentGameType="buzz_in"
        />
      ) : null}

      {loading ? (
        <div className={`${ui.card} py-12 text-center`}>
          <p className="text-sm text-zinc-500">Loading next question…</p>
          {isHost && stuckVisible && round ? (
            <button
              type="button"
              onClick={handleRecoverStuckRound}
              disabled={pending}
              className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Skip stuck round
            </button>
          ) : null}
        </div>
      ) : null}

      {!finished && !loading && round && question ? (
        <>
          <GroupGameScoreboard entries={state.scoreboard} currentUserId={currentUserId} />

          <BuzzRacePanel
            question={question}
            phase={phase}
            isPlaying={isPlaying}
            isBuzzer={isBuzzer}
            buzzerDisplayName={buzzerDisplayName}
            buzzedBy={round.buzzed_by}
            answerCorrect={round.answer_correct}
            pending={pending}
            onBuzz={handleBuzz}
            onAnswer={handleAnswer}
          />

          {isHost && stuckVisible ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleRecoverStuckRound}
                disabled={pending}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60"
              >
                Skip stuck round
              </button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </>
      ) : null}
    </div>
  );
}
