"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RaceStateRow } from "@/lib/point-race/types";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UsePointRaceRealtimeOptions = {
  roomId: string;
  currentUserId: string;
  onRoomChange: (room: GameRoomRow) => void;
  onMyRaceStateChange: (state: RaceStateRow) => void;
  onStandingsChange: () => void;
};

export function usePointRaceRealtime({
  roomId,
  currentUserId,
  onRoomChange,
  onMyRaceStateChange,
  onStandingsChange,
}: UsePointRaceRealtimeOptions) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`point-race:${roomId}`)
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
          table: "game_room_race_state",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as RaceStateRow | undefined;
          if (row?.player_id === currentUserId) {
            onMyRaceStateChange(row);
          }
          if (row && row.player_id !== currentUserId) {
            onStandingsChange();
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
        () => onStandingsChange()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, onRoomChange, onMyRaceStateChange, onStandingsChange]);
}
