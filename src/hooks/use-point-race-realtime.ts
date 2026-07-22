"use client";

import { useEffect, useRef } from "react";
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

/** In-game Point Race channel — callback refs avoid remount churn. */
export function usePointRaceRealtime({
  roomId,
  currentUserId,
  onRoomChange,
  onMyRaceStateChange,
  onStandingsChange,
}: UsePointRaceRealtimeOptions) {
  const onRoomChangeRef = useRef(onRoomChange);
  const onMyRaceStateChangeRef = useRef(onMyRaceStateChange);
  const onStandingsChangeRef = useRef(onStandingsChange);

  useEffect(() => {
    onRoomChangeRef.current = onRoomChange;
  }, [onRoomChange]);

  useEffect(() => {
    onMyRaceStateChangeRef.current = onMyRaceStateChange;
  }, [onMyRaceStateChange]);

  useEffect(() => {
    onStandingsChangeRef.current = onStandingsChange;
  }, [onStandingsChange]);

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
          if (payload.new) onRoomChangeRef.current(payload.new as GameRoomRow);
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
            onMyRaceStateChangeRef.current(row);
          }
          if (row && row.player_id !== currentUserId) {
            onStandingsChangeRef.current();
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
        () => onStandingsChangeRef.current()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId]);
}
