"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BuzzInRoundRow } from "@/lib/buzz-in/types";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UseBuzzInRealtimeOptions = {
  roomId: string;
  onRoomChange: (room: GameRoomRow) => void;
  onRoundChange: (round: BuzzInRoundRow) => void;
  onParticipantsChange: () => void;
};

/** In-game buzz-in channel — callback refs avoid remount churn. */
export function useBuzzInRealtime({
  roomId,
  onRoomChange,
  onRoundChange,
  onParticipantsChange,
}: UseBuzzInRealtimeOptions) {
  const onRoomChangeRef = useRef(onRoomChange);
  const onRoundChangeRef = useRef(onRoundChange);
  const onParticipantsChangeRef = useRef(onParticipantsChange);

  useEffect(() => {
    onRoomChangeRef.current = onRoomChange;
  }, [onRoomChange]);

  useEffect(() => {
    onRoundChangeRef.current = onRoundChange;
  }, [onRoundChange]);

  useEffect(() => {
    onParticipantsChangeRef.current = onParticipantsChange;
  }, [onParticipantsChange]);

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
            onRoomChangeRef.current(payload.new as GameRoomRow);
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
            onRoundChangeRef.current(payload.new as BuzzInRoundRow);
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
