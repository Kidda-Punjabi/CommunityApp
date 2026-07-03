"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SentenceRoundRow } from "@/lib/sentence-builder-group/types";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UseSentenceBuilderRealtimeOptions = {
  roomId: string;
  onRoomChange: (room: GameRoomRow) => void;
  onRoundChange: (round: SentenceRoundRow) => void;
  onParticipantsChange: () => void;
};

export function useSentenceBuilderRealtime({
  roomId,
  onRoomChange,
  onRoundChange,
  onParticipantsChange,
}: UseSentenceBuilderRealtimeOptions) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`sentence-builder:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) onRoomChange(payload.new as GameRoomRow);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_room_sentence_rounds",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) onRoundChange(payload.new as SentenceRoundRow);
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
  }, [roomId, onRoomChange, onRoundChange, onParticipantsChange]);
}
