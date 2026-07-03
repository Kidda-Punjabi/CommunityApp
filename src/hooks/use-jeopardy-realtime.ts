"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JeopardyTileRow } from "@/lib/jeopardy/types";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UseJeopardyRealtimeOptions = {
  roomId: string;
  onRoomChange: (room: GameRoomRow) => void;
  onTileChange: (tile: JeopardyTileRow) => void;
  onParticipantsChange: () => void;
};

export function useJeopardyRealtime({
  roomId,
  onRoomChange,
  onTileChange,
  onParticipantsChange,
}: UseJeopardyRealtimeOptions) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`jeopardy:${roomId}`)
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
          table: "game_room_jeopardy_tiles",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) onTileChange(payload.new as JeopardyTileRow);
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
  }, [roomId, onRoomChange, onTileChange, onParticipantsChange]);
}
