import type { SupabaseClient } from "@supabase/supabase-js";
import { getDisplayName } from "@/lib/profile/display-name";
import type {
  GameRoomParticipantRow,
  GameRoomParticipantView,
  GameRoomRow,
  GameRoomView,
} from "@/lib/game-rooms/types";

export async function loadGameRoom(
  supabase: SupabaseClient,
  roomId: string
): Promise<GameRoomRow | null> {
  const { data, error } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error) throw error;
  return (data as GameRoomRow | null) ?? null;
}

export async function loadActiveParticipants(
  supabase: SupabaseClient,
  roomId: string
): Promise<GameRoomParticipantRow[]> {
  const { data, error } = await supabase
    .from("game_room_participants")
    .select("*")
    .eq("room_id", roomId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return (data as GameRoomParticipantRow[]) ?? [];
}

async function loadParticipantProfiles(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, { displayName: string; avatarUrl: string | null }>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, avatar_url")
    .in("id", userIds);

  if (error) throw error;

  const map = new Map<string, { displayName: string; avatarUrl: string | null }>();
  for (const row of data ?? []) {
    map.set(row.id, {
      displayName: getDisplayName(row) ?? "Player",
      avatarUrl: row.avatar_url ?? null,
    });
  }
  return map;
}

export async function loadGameRoomView(
  supabase: SupabaseClient,
  roomId: string,
  currentUserId: string
): Promise<GameRoomView | null> {
  const room = await loadGameRoom(supabase, roomId);
  if (!room) return null;

  const participantRows = await loadActiveParticipants(supabase, roomId);
  const isMember = participantRows.some((p) => p.user_id === currentUserId);
  if (!isMember) return null;

  const profiles = await loadParticipantProfiles(
    supabase,
    participantRows.map((p) => p.user_id)
  );

  const participants: GameRoomParticipantView[] = participantRows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      displayName: profile?.displayName ?? "Player",
      avatarUrl: profile?.avatarUrl ?? null,
      isHost: row.is_host,
      isPlaying: row.is_playing,
    };
  });

  const self = participantRows.find((p) => p.user_id === currentUserId);

  return {
    room,
    participants,
    currentUserId,
    isHost: self?.is_host ?? room.host_id === currentUserId,
  };
}
