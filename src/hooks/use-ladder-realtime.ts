"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`ladder:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new) onRoomChange(payload.new as GameRoomRow);
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
          if (payload.new) onRunChange(payload.new as LadderRunRow);
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
        () => onParticipantsChange()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, onRoomChange, onRunChange, onParticipantsChange]);

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
          if (payload.new) onQuestionChange(payload.new as LadderQuestionRow);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeRunId, onQuestionChange]);

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
        () => onVotesChange()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeQuestionId, onVotesChange]);
}
