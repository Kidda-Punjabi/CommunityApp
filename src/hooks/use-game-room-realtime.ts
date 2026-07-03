"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UseGameRoomRealtimeOptions = {
  roomId: string;
  onRoomChange: (room: GameRoomRow) => void;
  onParticipantsChange: () => void;
};

export function useGameRoomRealtime({
  roomId,
  onRoomChange,
  onParticipantsChange,
}: UseGameRoomRealtimeOptions) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`game-room:${roomId}`)
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
  }, [roomId, onRoomChange, onParticipantsChange]);
}
