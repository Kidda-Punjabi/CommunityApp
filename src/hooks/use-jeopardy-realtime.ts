"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JeopardyTileRow } from "@/lib/jeopardy/types";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UseJeopardyRealtimeOptions = {
  roomId: string;
  onRoomChange: (room: GameRoomRow) => void;
  onTileChange: (tile: JeopardyTileRow) => void;
  onParticipantsChange: () => void;
  onResync?: () => void;
};

/** In-game Jeopardy channel — callback refs avoid remount churn. */
export function useJeopardyRealtime({
  roomId,
  onRoomChange,
  onTileChange,
  onParticipantsChange,
  onResync,
}: UseJeopardyRealtimeOptions) {
  const onRoomChangeRef = useRef(onRoomChange);
  const onTileChangeRef = useRef(onTileChange);
  const onParticipantsChangeRef = useRef(onParticipantsChange);
  const onResyncRef = useRef(onResync);

  useEffect(() => {
    onRoomChangeRef.current = onRoomChange;
  }, [onRoomChange]);

  useEffect(() => {
    onTileChangeRef.current = onTileChange;
  }, [onTileChange]);

  useEffect(() => {
    onParticipantsChangeRef.current = onParticipantsChange;
  }, [onParticipantsChange]);

  useEffect(() => {
    onResyncRef.current = onResync;
  }, [onResync]);

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
          if (payload.new) onRoomChangeRef.current(payload.new as GameRoomRow);
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
          if (payload.new) onTileChangeRef.current(payload.new as JeopardyTileRow);
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          onResyncRef.current?.();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
