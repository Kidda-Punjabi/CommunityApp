"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BuzzInRoundRow } from "@/lib/buzz-in/types";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UseBuzzInRealtimeOptions = {
  roomId: string;
  onRoomChange: (room: GameRoomRow) => void;
  onRoundChange: (round: BuzzInRoundRow) => void;
  onParticipantsChange: () => void;
};

export function useBuzzInRealtime({
  roomId,
  onRoomChange,
  onRoundChange,
  onParticipantsChange,
}: UseBuzzInRealtimeOptions) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`buzz-in:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            onRoomChange(payload.new as GameRoomRow);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_room_rounds",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            onRoundChange(payload.new as BuzzInRoundRow);
          }
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
        () => {
          onParticipantsChange();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, onRoomChange, onRoundChange, onParticipantsChange]);
}
