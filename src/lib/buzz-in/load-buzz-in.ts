import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBuzzInRounds } from "@/lib/buzz-in/build-questions";
import type { BuzzInGameState, BuzzInRoundRow } from "@/lib/buzz-in/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";

export async function loadBuzzInRounds(
  supabase: SupabaseClient,
  roomId: string
): Promise<BuzzInRoundRow[]> {
  const { data, error } = await supabase
    .from("game_room_rounds")
    .select("*")
    .eq("room_id", roomId)
    .order("round_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as BuzzInRoundRow[];
}

export async function loadBuzzInRound(
  supabase: SupabaseClient,
  roomId: string,
  roundNumber: number
): Promise<BuzzInRoundRow | null> {
  const { data, error } = await supabase
    .from("game_room_rounds")
    .select("*")
    .eq("room_id", roomId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (error) throw error;
  return (data as BuzzInRoundRow | null) ?? null;
}

export async function ensureBuzzInInitialized(
  supabase: SupabaseClient,
  room: GameRoomRow
): Promise<void> {
  if (room.game_type !== "buzz_in" || room.status !== "in_progress") return;

  const existing = await loadBuzzInRounds(supabase, room.id);
  if (existing.length > 0) return;

  const questionCount =
    typeof room.settings?.question_count === "number" ? room.settings.question_count : 10;

  const rounds = await buildBuzzInRounds(supabase, questionCount);
  const { error } = await supabase.rpc("buzz_in_initialize_rounds", {
    p_room_id: room.id,
    p_rounds: rounds,
  });

  if (error) throw error;
}

export async function loadBuzzInGameState(
  supabase: SupabaseClient,
  room: GameRoomRow,
  currentUserId: string
): Promise<BuzzInGameState | null> {
  const { data: participantRows, error: participantError } = await supabase
    .from("game_room_participants")
    .select("*")
    .eq("room_id", room.id)
    .is("left_at", null)
    .order("score", { ascending: false });

  if (participantError) throw participantError;

  const isMember = (participantRows ?? []).some((p) => p.user_id === currentUserId);
  if (!isMember) return null;

  const self = (participantRows ?? []).find((p) => p.user_id === currentUserId);

  const userIds = (participantRows ?? []).map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, getDisplayName(p) ?? "Player"])
  );

  const rounds = await loadBuzzInRounds(supabase, room.id);
  const currentRoundNumber =
    typeof room.settings?.current_round === "number" ? room.settings.current_round : 1;

  const currentRound =
    rounds.find((r) => r.round_number === currentRoundNumber) ??
    rounds.find((r) => !r.resolved_at) ??
    null;

  return {
    roomId: room.id,
    currentRoundNumber,
    totalRounds: rounds.length,
    currentRound,
    scoreboard: (participantRows ?? []).map((p) => ({
      userId: p.user_id,
      displayName: profileMap.get(p.user_id) ?? "Player",
      score: p.score,
      isPlaying: p.is_playing,
      isHost: p.is_host,
    })),
    roomStatus: room.status as BuzzInGameState["roomStatus"],
    currentUserId,
    isPlaying: self?.is_playing ?? false,
  };
}
