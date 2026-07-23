"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { submitTilePlacementAction } from "@/app/dashboard/group-games/sentence-actions";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { GroupGameScoreboard } from "@/components/group-games/group-game-scoreboard";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { useSentenceBuilderRealtime } from "@/hooks/use-sentence-builder-realtime";
import {
  availablePoolTiles,
  correctTileSequence,
} from "@/lib/sentence-builder-group/tiles";
import type { SentenceBuilderGroupState, SentenceRoundRow } from "@/lib/sentence-builder-group/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { latinRomanised } from "@/lib/conjugation/romanised";
import { ui } from "@/lib/ui/styles";

type SentenceBuilderGroupArenaProps = {
  initialState: SentenceBuilderGroupState;
  initialRoom: GameRoomRow;
};

const FEEDBACK_MS = 900;
const ROUND_REVEAL_MS = 2400;

function countCorrectTiles(round: SentenceRoundRow): number {
  return round.tile_pool.filter((tile) => !tile.is_distractor).length;
}

export function SentenceBuilderGroupArena({
  initialState,
  initialRoom,
}: SentenceBuilderGroupArenaProps) {
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [rounds, setRounds] = useState(initialState.rounds);
  const [activeRound, setActiveRound] = useState(initialState.activeRound);
  const [latestCompletedRound, setLatestCompletedRound] = useState(
    initialState.latestCompletedRound
  );
  const [revealedTranslation, setRevealedTranslation] = useState(
    initialState.revealedTranslation
  );
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const feedbackTimerRef = useRef<number | null>(null);

  const { currentUserId, isPlaying, scoreboard, totalRounds } = state;

  const turnPlayerId = activeRound?.current_turn_player_id ?? null;
  const isMyTurn = Boolean(isPlaying && turnPlayerId === currentUserId);
  const turnPlayerName =
    scoreboard.find((entry) => entry.userId === turnPlayerId)?.displayName ?? "Someone";

  const poolTiles = useMemo(() => {
    if (!activeRound) return [];
    return availablePoolTiles(activeRound.tile_pool, activeRound.filled_slots);
  }, [activeRound]);

  const slotCount = activeRound ? countCorrectTiles(activeRound) : 0;
  const filledSlots = activeRound?.filled_slots ?? [];
  const emptySlotCount = Math.max(0, slotCount - filledSlots.length);

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

  const fetchTranslation = useCallback(async (grammarSentenceId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("grammar_sentences")
      .select("english_translation")
      .eq("id", grammarSentenceId)
      .maybeSingle();
    setRevealedTranslation(data?.english_translation ?? null);
  }, []);

  const applyRound = useCallback(
    (next: SentenceRoundRow) => {
      setRounds((prev) => {
        const exists = prev.some((r) => r.id === next.id);
        if (exists) return prev.map((r) => (r.id === next.id ? next : r));
        return [...prev, next].sort((a, b) => a.round_number - b.round_number);
      });

      if (next.status === "active") {
        setActiveRound(next);
        setLatestCompletedRound(null);
        setRevealedTranslation(null);
        return;
      }

      if (next.status === "completed") {
        setActiveRound(null);
        setLatestCompletedRound(next);
        void fetchTranslation(next.grammar_sentence_id);
        window.setTimeout(() => {
          setLatestCompletedRound(null);
          setRevealedTranslation(null);
        }, ROUND_REVEAL_MS);
      }
    },
    [fetchTranslation]
  );

  const handleRoomChange = useCallback(
    (next: GameRoomRow) => {
      setRoom(next);
      if (next.status === "completed") void refreshScoreboard();
    },
    [refreshScoreboard]
  );

  useSentenceBuilderRealtime({
    roomId: room.id,
    onRoomChange: handleRoomChange,
    onRoundChange: (next) => {
      applyRound(next);
      if (next.status === "completed") void refreshScoreboard();
    },
    onParticipantsChange: refreshScoreboard,
  });

  const handleTilePick = (tileIdentifier: string) => {
    if (!activeRound || !isMyTurn || pending) return;

    setError(null);
    startTransition(async () => {
      const result = await submitTilePlacementAction(
        room.id,
        activeRound.id,
        tileIdentifier
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setFeedback(result.wasCorrect ? "correct" : "wrong");
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);

      if (result.wasCorrect) void refreshScoreboard();
      if (result.gameCompleted) void refreshScoreboard();
    });
  };

  if (room.status === "completed") {
    return (
      <GroupGameLeaderboard
        title="Collaborative Sentence Builder"
        entries={scoreboard}
        currentUserId={currentUserId}
      />
    );
  }

  if (!activeRound && latestCompletedRound) {
    return (
      <div className="space-y-5">
        <GroupGameScoreboard entries={scoreboard} currentUserId={currentUserId} />
        <div className={`${ui.card} space-y-4 py-8 text-center`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Sentence complete
          </p>
          <p className="text-lg font-semibold text-zinc-900">
            Round {latestCompletedRound.round_number} of {totalRounds}
          </p>
          {revealedTranslation ? (
            <p className="text-base text-zinc-600">{revealedTranslation}</p>
          ) : null}
          <p className="text-sm text-zinc-500">Next sentence loading…</p>
        </div>
      </div>
    );
  }

  if (!activeRound) {
    return (
      <div className={`${ui.card} py-12 text-center`}>
        <p className="text-sm text-zinc-500">Loading sentence…</p>
      </div>
    );
  }

  const roundLabel = `Round ${activeRound.round_number} of ${totalRounds}`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Collaborative Sentence Builder
          </p>
          <h1 className="text-lg font-bold text-zinc-900">{roundLabel}</h1>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium text-zinc-500">+1 per correct tile</p>
          <GameTutorialHost tutorialId="sentence_builder_group" />
        </div>
      </div>

      <GroupGameScoreboard entries={scoreboard} currentUserId={currentUserId} />

      <div
        className={`${ui.card} space-y-3 ${
          feedback === "correct"
            ? "ring-2 ring-emerald-400"
            : feedback === "wrong"
              ? "ring-2 ring-rose-400"
              : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-700">
            {isMyTurn ? "Your turn — pick the next word" : `Waiting for ${turnPlayerName}'s turn`}
          </p>
          {!isPlaying ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
              Spectating
            </span>
          ) : null}
        </div>

        <div className="flex min-h-[3.5rem] flex-wrap gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-3">
          {filledSlots.map((slot) => {
            const latin = latinRomanised(slot.romanised);
            return (
              <span
                key={slot.tile_identifier}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
              >
                <span>{slot.gurmukhi}</span>
                {latin ? (
                  <span className="mt-0.5 block text-xs font-normal text-violet-200">{latin}</span>
                ) : null}
              </span>
            );
          })}
          {Array.from({ length: emptySlotCount }).map((_, index) => (
            <span
              key={`empty-${index}`}
              className="inline-flex min-w-[4rem] items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-300"
            >
              —
            </span>
          ))}
        </div>

        <p className="text-xs text-zinc-400">
          {correctTileSequence(
            activeRound.tile_pool.map((t) => ({
              gurmukhi: t.gurmukhi,
              romanised: t.romanised,
              correct_position: t.correct_position,
              is_distractor: t.is_distractor,
            }))
          ).length}{" "}
          words to build · English hint revealed when the sentence is complete
        </p>
      </div>

      <div className={`${ui.card} space-y-3`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Word pool</p>
        <div className="flex flex-wrap gap-2">
          {poolTiles.map((tile) => {
            const disabled = !isMyTurn || pending;
            const latin = latinRomanised(tile.romanised);
            return (
              <button
                key={tile.tile_identifier}
                type="button"
                disabled={disabled}
                onClick={() => handleTilePick(tile.tile_identifier)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  disabled
                    ? "cursor-default border-zinc-200 bg-zinc-50 text-zinc-400"
                    : "border-violet-200 bg-white text-violet-800 hover:border-violet-400 hover:bg-violet-50 active:scale-95"
                }`}
              >
                <span>{tile.gurmukhi}</span>
                {latin ? (
                  <span
                    className={`mt-0.5 block text-xs font-normal ${
                      disabled ? "text-zinc-400" : "text-violet-600"
                    }`}
                  >
                    {latin}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
