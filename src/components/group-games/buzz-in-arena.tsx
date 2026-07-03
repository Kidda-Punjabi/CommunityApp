"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  claimBuzzIn,
  resolveBuzzInTimeout,
  submitBuzzInAnswer,
} from "@/app/dashboard/group-games/buzz-in-actions";
import { BuzzRacePanel } from "@/components/group-games/buzz-race-panel";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { GroupGameScoreboard } from "@/components/group-games/group-game-scoreboard";
import { useBuzzInRealtime } from "@/hooks/use-buzz-in-realtime";
import { useBuzzRaceTimeout } from "@/hooks/use-buzz-race-timeout";
import { BUZZ_IN_POINTS_PER_CORRECT } from "@/lib/buzz-in/constants";
import type { BuzzInGameState, BuzzInRoundRow } from "@/lib/buzz-in/types";
import { BUZZ_RACE_RESULT_DELAY_MS } from "@/lib/group-games/buzz-race-constants";
import { deriveBuzzRacePhase, type BuzzRacePhase } from "@/lib/group-games/buzz-race-types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

type BuzzInArenaProps = {
  initialState: BuzzInGameState;
  initialRoom: GameRoomRow;
};

export function BuzzInArena({ initialState, initialRoom }: BuzzInArenaProps) {
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [round, setRound] = useState<BuzzInRoundRow | null>(initialState.currentRound);
  const [phase, setPhase] = useState<BuzzRacePhase>(() =>
    deriveBuzzRacePhase(initialState.currentRound, initialRoom.status)
  );
  const [buzzerName, setBuzzerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const resultTimerRef = useRef<number | null>(null);

  const { currentUserId, isPlaying } = state;
  const isBuzzer = round?.buzzed_by === currentUserId;
  const question = round?.question_payload;

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
      setPhase(deriveBuzzRacePhase(next, room.status));

      if (next.buzzed_by) void loadBuzzerName(next.buzzed_by);
      else setBuzzerName(null);

      if (next.resolved_at) {
        void refreshScoreboard();
        if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
        resultTimerRef.current = window.setTimeout(() => {
          setPhase("waiting");
        }, BUZZ_RACE_RESULT_DELAY_MS);
      }
    },
    [loadBuzzerName, refreshScoreboard, room.status]
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

  const handleRoomChange = useCallback(
    (next: GameRoomRow) => {
      const prevRoundNumber =
        typeof room.settings?.current_round === "number" ? room.settings.current_round : null;
      const nextRoundNumber =
        typeof next.settings?.current_round === "number" ? next.settings.current_round : null;

      setRoom(next);
      setState((prev) => ({
        ...prev,
        roomStatus: next.status as BuzzInGameState["roomStatus"],
        currentRoundNumber: nextRoundNumber ?? prev.currentRoundNumber,
      }));

      if (next.status === "completed") {
        setPhase("finished");
        void refreshScoreboard();
        return;
      }

      if (nextRoundNumber !== null && nextRoundNumber !== prevRoundNumber) {
        void fetchRoundByNumber(nextRoundNumber);
      }
    },
    [fetchRoundByNumber, refreshScoreboard, room.settings?.current_round]
  );

  const handleRoundChange = useCallback(
    (next: BuzzInRoundRow) => {
      if (next.room_id !== room.id) return;
      if (round?.id === next.id || (next.opened_at && !next.resolved_at)) {
        applyRound(next);
      }
    },
    [applyRound, room.id, round?.id]
  );

  useBuzzInRealtime({
    roomId: room.id,
    onRoomChange: handleRoomChange,
    onRoundChange: handleRoundChange,
    onParticipantsChange: refreshScoreboard,
  });

  const handleTimeout = useCallback(async (roundId: string) => {
    await resolveBuzzInTimeout(roundId);
  }, []);

  useBuzzRaceTimeout({
    itemId: round?.id ?? null,
    openedAt: round?.opened_at ?? null,
    buzzedAt: round?.buzzed_at ?? null,
    buzzedBy: round?.buzzed_by ?? null,
    resolvedAt: round?.resolved_at ?? null,
    enabled: phase !== "finished" && phase !== "waiting" && phase !== "result",
    onTimeout: handleTimeout,
  });

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

  const buzzerDisplayName =
    buzzerName ??
    state.scoreboard.find((entry) => entry.userId === round?.buzzed_by)?.displayName ??
    "Someone";

  if (phase === "finished" || room.status === "completed") {
    return (
      <GroupGameLeaderboard
        title="Buzz-in"
        entries={state.scoreboard}
        currentUserId={currentUserId}
      />
    );
  }

  if (!round || phase === "waiting" || !question) {
    return (
      <div className={`${ui.card} py-12 text-center`}>
        <p className="text-sm text-zinc-500">Loading next question…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Buzz-in</p>
          <h1 className="text-lg font-bold text-zinc-900">
            Question {round.round_number} of {state.totalRounds}
          </h1>
        </div>
        <p className="text-xs font-medium text-zinc-500">
          +{BUZZ_IN_POINTS_PER_CORRECT} per correct
        </p>
      </div>

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

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
