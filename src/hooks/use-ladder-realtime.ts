"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LadderQuestionRow, LadderRunRow } from "@/lib/chado-pauri-group/types";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UseLadderRealtimeOptions = {
  roomId: string;
  activeRunId: string | null;
  activeQuestionId: string | null;
  onRoomChange: (room: GameRoomRow) => void;
  onRunChange: (run: LadderRunRow) => void;
  onQuestionChange: (question: LadderQuestionRow) => void;
  onVotesChange: () => void;
  onParticipantsChange: () => void;
};

/**
 * Realtime subscriptions remount only when room / run / question IDs change.
 * Callbacks are kept in refs so parent re-renders (or unstable inline handlers)
 * do not tear down Supabase channels.
 */
export function useLadderRealtime({
  roomId,
  activeRunId,
  activeQuestionId,
  onRoomChange,
  onRunChange,
  onQuestionChange,
  onVotesChange,
  onParticipantsChange,
}: UseLadderRealtimeOptions) {
  const onRoomChangeRef = useRef(onRoomChange);
  const onRunChangeRef = useRef(onRunChange);
  const onQuestionChangeRef = useRef(onQuestionChange);
  const onVotesChangeRef = useRef(onVotesChange);
  const onParticipantsChangeRef = useRef(onParticipantsChange);

  useEffect(() => {
    onRoomChangeRef.current = onRoomChange;
  }, [onRoomChange]);

  useEffect(() => {
    onRunChangeRef.current = onRunChange;
  }, [onRunChange]);

  useEffect(() => {
    onQuestionChangeRef.current = onQuestionChange;
  }, [onQuestionChange]);

  useEffect(() => {
    onVotesChangeRef.current = onVotesChange;
  }, [onVotesChange]);

  useEffect(() => {
    onParticipantsChangeRef.current = onParticipantsChange;
  }, [onParticipantsChange]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`ladder:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new) onRoomChangeRef.current(payload.new as GameRoomRow);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_room_ladder_runs",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) onRunChangeRef.current(payload.new as LadderRunRow);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_room_participants",
          filter: `room_id=eq.${roomId}`,
        },
        () => onParticipantsChangeRef.current()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (!activeRunId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`ladder-q:${activeRunId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_room_ladder_questions",
          filter: `run_id=eq.${activeRunId}`,
        },
        (payload) => {
          if (payload.new) onQuestionChangeRef.current(payload.new as LadderQuestionRow);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeRunId]);

  useEffect(() => {
    if (!activeQuestionId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`ladder-v:${activeQuestionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_room_ladder_votes",
          filter: `question_id=eq.${activeQuestionId}`,
        },
        () => onVotesChangeRef.current()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeQuestionId]);
}
