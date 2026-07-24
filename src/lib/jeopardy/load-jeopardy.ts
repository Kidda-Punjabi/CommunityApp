import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildJeopardyBoard,
  pickInitialJeopardyPicker,
} from "@/lib/jeopardy/build-board";
import type { JeopardyGameState, JeopardyTileRow } from "@/lib/jeopardy/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";

export async function loadJeopardyTiles(
  supabase: SupabaseClient,
  roomId: string
): Promise<JeopardyTileRow[]> {
  const { data, error } = await supabase
    .from("game_room_jeopardy_tiles")
    .select("*")
    .eq("room_id", roomId)
    .order("point_value", { ascending: true })
    .order("category", { ascending: true });

  if (error) throw error;
  return (data ?? []) as JeopardyTileRow[];
}

export async function ensureJeopardyInitialized(
  supabase: SupabaseClient,
  room: GameRoomRow
): Promise<void> {
  if (room.game_type !== "jeopardy" || room.status !== "in_progress") return;

  const existing = await loadJeopardyTiles(supabase, room.id);
  if (existing.length > 0) return;

  const { tiles, skipped } = await buildJeopardyBoard(supabase, room.settings);
  const initialPickerId = await pickInitialJeopardyPicker(supabase, room.id, room.host_id);

  const { error } = await supabase.rpc("jeopardy_initialize_board", {
    p_room_id: room.id,
    p_tiles: tiles,
    p_initial_picker_id: initialPickerId,
    p_skipped_tiles: skipped,
  });

  if (error) throw error;
}

export async function loadJeopardyGameState(
  supabase: SupabaseClient,
  room: GameRoomRow,
  currentUserId: string
): Promise<JeopardyGameState | null> {
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

  const tiles = await loadJeopardyTiles(supabase, room.id);
  const activeTile = tiles.find((t) => t.status === "active") ?? null;
  const skippedTiles = Array.isArray(room.settings?.skipped_tiles)
    ? (room.settings.skipped_tiles as JeopardyGameState["skippedTiles"])
    : [];

  return {
    roomId: room.id,
    tiles,
    activeTile,
    currentPickerId: room.current_picker_id ?? null,
    skippedTiles,
    scoreboard: (participantRows ?? []).map((p) => ({
      userId: p.user_id,
      displayName: profileMap.get(p.user_id) ?? "Player",
      score: p.score,
      isPlaying: p.is_playing,
      isHost: p.is_host,
    })),
    roomStatus: room.status as JeopardyGameState["roomStatus"],
    currentUserId,
    isPlaying: self?.is_playing ?? false,
  };
}
