"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BattleRoundRow, BattleSessionRow } from "@/lib/battle/types";

type UseBattleRealtimeOptions = {
  sessionId: string;
  onSessionChange: (session: BattleSessionRow) => void;
  onRoundChange: (round: BattleRoundRow) => void;
};

/**
 * Battle session channel. Callbacks are stored in refs so parent re-renders
 * (e.g. handleRoundChange closing over phase/round) do not tear down the
 * channel and miss opponent-join or round-start events.
 */
export function useBattleRealtime({
  sessionId,
  onSessionChange,
  onRoundChange,
}: UseBattleRealtimeOptions) {
  const onSessionChangeRef = useRef(onSessionChange);
  const onRoundChangeRef = useRef(onRoundChange);

  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  useEffect(() => {
    onRoundChangeRef.current = onRoundChange;
  }, [onRoundChange]);

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
            onSessionChangeRef.current(payload.new as BattleSessionRow);
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
            onRoundChangeRef.current(payload.new as BattleRoundRow);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Recover any session transition missed while the channel was down.
          void supabase
            .from("battle_sessions")
            .select("*")
            .eq("id", sessionId)
            .maybeSingle()
            .then(({ data }) => {
              if (data) onSessionChangeRef.current(data as BattleSessionRow);
            });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);
}
