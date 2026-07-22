"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SentenceRoundRow } from "@/lib/sentence-builder-group/types";
import type { GameRoomRow } from "@/lib/game-rooms/types";

type UseSentenceBuilderRealtimeOptions = {
  roomId: string;
  onRoomChange: (room: GameRoomRow) => void;
  onRoundChange: (round: SentenceRoundRow) => void;
  onParticipantsChange: () => void;
};

/** In-game sentence-builder channel — callback refs avoid remount churn. */
export function useSentenceBuilderRealtime({
  roomId,
  onRoomChange,
  onRoundChange,
  onParticipantsChange,
}: UseSentenceBuilderRealtimeOptions) {
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
          if (payload.new) onRoomChangeRef.current(payload.new as GameRoomRow);
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
          if (payload.new) onRoundChangeRef.current(payload.new as SentenceRoundRow);
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
