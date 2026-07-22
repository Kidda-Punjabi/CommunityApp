"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UseGameRoomRealtimeOptions = {
  roomId: string;
  onRoomChange: (room: GameRoomRow) => void;
  onParticipantsChange: () => void;
};

/**
 * Lobby + in-game room channel. Callbacks are stored in refs so parent
 * re-renders (e.g. unstable `router` in onRoomChange deps) do not tear
 * down and miss participant INSERT events on the host.
 */
export function useGameRoomRealtime({
  roomId,
  onRoomChange,
  onParticipantsChange,
}: UseGameRoomRealtimeOptions) {
  const onRoomChangeRef = useRef(onRoomChange);
  const onParticipantsChangeRef = useRef(onParticipantsChange);

  useEffect(() => {
    onRoomChangeRef.current = onRoomChange;
  }, [onRoomChange]);

  useEffect(() => {
    onParticipantsChangeRef.current = onParticipantsChange;
  }, [onParticipantsChange]);

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
            onRoomChangeRef.current(payload.new as GameRoomRow);
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
          onParticipantsChangeRef.current();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          onParticipantsChangeRef.current();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
