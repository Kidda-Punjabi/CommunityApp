import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInitialRaceQuestions } from "@/lib/point-race/build-questions";
import { POINT_RACE_WIN_SCORE } from "@/lib/point-race/constants";
import type { PointRaceGameState, RaceStanding, RaceStateRow } from "@/lib/point-race/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";

export async function loadMyRaceState(
  supabase: SupabaseClient,
  roomId: string,
  userId: string
): Promise<RaceStateRow | null> {
  const { data, error } = await supabase
    .from("game_room_race_state")
    .select("*")
    .eq("room_id", roomId)
    .eq("player_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as RaceStateRow | null) ?? null;
}

export async function loadRaceStandings(
  supabase: SupabaseClient,
  roomId: string
): Promise<Array<Omit<RaceStanding, "displayName">>> {
  const { data, error } = await supabase.rpc("list_race_standings", { p_room_id: roomId });
  if (error) throw error;

  return (data ?? []).map(
    (row: {
      player_id: string;
      score: number;
      questions_answered: number;
      is_winner: boolean;
    }) => ({
      playerId: row.player_id,
      score: row.score,
      questionsAnswered: row.questions_answered,
      isWinner: row.is_winner,
    })
  );
}

export async function ensurePointRaceInitialized(
  supabase: SupabaseClient,
  room: GameRoomRow
): Promise<void> {
  if (room.game_type !== "point_race" || room.status !== "in_progress") return;

  const { data: existing, error: existingError } = await supabase
    .from("game_room_race_state")
    .select("id")
    .eq("room_id", room.id)
    .limit(1);

  if (existingError) throw existingError;
  if ((existing ?? []).length > 0) return;

  const { data: playingRows, error: participantError } = await supabase
    .from("game_room_participants")
    .select("user_id")
    .eq("room_id", room.id)
    .eq("is_playing", true)
    .is("left_at", null);

  if (participantError) throw participantError;

  const playerIds = (playingRows ?? []).map((row) => row.user_id);
  if (playerIds.length === 0) {
    throw new Error("No playing participants to start point race.");
  }

  const states = await buildInitialRaceQuestions(supabase, playerIds);
  const { error } = await supabase.rpc("race_initialize_game", {
    p_room_id: room.id,
    p_states: states,
  });

  if (error) throw error;
}

export async function loadPointRaceGameState(
  supabase: SupabaseClient,
  room: GameRoomRow,
  currentUserId: string
): Promise<PointRaceGameState | null> {
  const { data: participantRows, error: participantError } = await supabase
    .from("game_room_participants")
    .select("user_id, is_playing")
    .eq("room_id", room.id)
    .is("left_at", null);

  if (participantError) throw participantError;

  const isMember = (participantRows ?? []).some((p) => p.user_id === currentUserId);
  if (!isMember) return null;

  const self = (participantRows ?? []).find((p) => p.user_id === currentUserId);

  const standingsRaw = await loadRaceStandings(supabase, room.id);
  const userIds = standingsRaw.map((s) => s.playerId);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", userIds.length > 0 ? userIds : [currentUserId]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, getDisplayName(p) ?? "Player"])
  );

  const standings: RaceStanding[] = standingsRaw.map((s) => ({
    ...s,
    displayName: profileMap.get(s.playerId) ?? "Player",
  }));

  const myRaceState = self?.is_playing
    ? await loadMyRaceState(supabase, room.id, currentUserId)
    : null;

  const winScore =
    typeof room.settings?.win_score === "number" ? room.settings.win_score : POINT_RACE_WIN_SCORE;
  const winnerId =
    typeof room.settings?.winner_id === "string" ? room.settings.winner_id : null;

  return {
    roomId: room.id,
    myRaceState,
    standings,
    winScore,
    winnerId,
    roomStatus: room.status as PointRaceGameState["roomStatus"],
    currentUserId,
    isPlaying: self?.is_playing ?? false,
  };
}
