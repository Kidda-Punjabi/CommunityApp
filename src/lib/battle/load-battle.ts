import type { SupabaseClient } from "@supabase/supabase-js";
import { getDisplayName } from "@/lib/profile/display-name";
import type { BattleRoundRow, BattleSessionRow } from "@/lib/battle/types";

export type BattlePlayerProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type BattleSessionView = {
  session: BattleSessionRow;
  playerOne: BattlePlayerProfile;
  playerTwo: BattlePlayerProfile | null;
  currentRound: BattleRoundRow | null;
};

export async function loadBattleSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<BattleSessionRow | null> {
  const { data, error } = await supabase
    .from("battle_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as BattleSessionRow | null) ?? null;
}

export async function loadBattleRound(
  supabase: SupabaseClient,
  sessionId: string,
  roundNumber: number
): Promise<BattleRoundRow | null> {
  const { data, error } = await supabase
    .from("battle_rounds")
    .select("*")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    question_payload: data.question_payload,
  } as BattleRoundRow;
}

async function loadProfiles(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, BattlePlayerProfile>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, avatar_url")
    .in("id", ids);

  if (error) throw error;

  const map = new Map<string, BattlePlayerProfile>();
  for (const row of data ?? []) {
    map.set(row.id, {
      id: row.id,
      displayName: getDisplayName(row) ?? "Player",
      avatarUrl: row.avatar_url ?? null,
    });
  }
  return map;
}

export async function loadBattleSessionView(
  supabase: SupabaseClient,
  sessionId: string
): Promise<BattleSessionView | null> {
  const session = await loadBattleSession(supabase, sessionId);
  if (!session) return null;

  const profileIds = [session.player_one_id, session.player_two_id].filter(
    (id): id is string => Boolean(id)
  );
  const profiles = await loadProfiles(supabase, profileIds);

  const currentRound =
    session.status === "active"
      ? await loadBattleRound(supabase, sessionId, session.current_round)
      : null;

  return {
    session,
    playerOne: profiles.get(session.player_one_id) ?? {
      id: session.player_one_id,
      displayName: "Player 1",
      avatarUrl: null,
    },
    playerTwo: session.player_two_id
      ? (profiles.get(session.player_two_id) ?? {
          id: session.player_two_id,
          displayName: "Player 2",
          avatarUrl: null,
        })
      : null,
    currentRound,
  };
}
