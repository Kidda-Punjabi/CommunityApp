"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BattleRoundRow, BattleSessionRow } from "@/lib/battle/types";

type UseBattleRealtimeOptions = {
  sessionId: string;
  onSessionChange: (session: BattleSessionRow) => void;
  onRoundChange: (round: BattleRoundRow) => void;
};

export function useBattleRealtime({
  sessionId,
  onSessionChange,
  onRoundChange,
}: UseBattleRealtimeOptions) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`battle:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battle_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new) {
            onSessionChange(payload.new as BattleSessionRow);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battle_rounds",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new) {
            onRoundChange(payload.new as BattleRoundRow);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, onSessionChange, onRoundChange]);
}
