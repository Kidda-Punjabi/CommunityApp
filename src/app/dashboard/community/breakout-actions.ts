"use server";

import { revalidatePath } from "next/cache";
import { buildRoomContentSettings } from "@/lib/group-games/content-filters";
import { signRoomActivity, voteInDebate } from "@/lib/community/breakout";
import { requireCommunityMember } from "@/lib/community/member-guard";
import { createClient } from "@/lib/supabase/server";

function refresh() {
  revalidatePath("/dashboard/community");
  revalidatePath("/admin/community/today");
}

export async function castDebateVote(activityId: string, choice: "a" | "b") {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const result = await voteInDebate(member.admin, member.userId, activityId, choice);
  refresh();
  return result;
}

export async function markActivityDone(activityId: string) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const result = await signRoomActivity(member.admin, member.userId, activityId);
  refresh();
  return result;
}

export async function openPointRace(activityId: string) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const { data: activity, error } = await member.admin
    .from("community_room_activities")
    .select("id, kind, payload, status")
    .eq("id", activityId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!activity || activity.kind !== "point_race" || activity.status !== "active") {
    return { error: "Point Race is not open." };
  }
  const payload = (activity.payload ?? {}) as { topicTags?: string[]; questionCount?: number; gameRoomId?: string | null; joinCode?: string | null };
  if (payload.gameRoomId && payload.joinCode) {
    const supabase = await createClient();
    const { error: joinError } = await supabase.rpc("join_game_room", { p_join_code: payload.joinCode });
    if (joinError && !joinError.message.toLowerCase().includes("already")) {
      return { error: joinError.message, href: `/dashboard/group-games/room/${payload.gameRoomId}` };
    }
    return { ok: true as const, href: `/dashboard/group-games/room/${payload.gameRoomId}` };
  }
  const supabase = await createClient();
  const settings = buildRoomContentSettings({
    questionCount: payload.questionCount ?? 10,
    gameType: "point_race",
    topicTags: payload.topicTags ?? [],
  });
  const { data, error: createError } = await supabase.rpc("create_game_room", {
    p_game_type: "point_race",
    p_settings: settings,
  });
  if (createError) return { error: createError.message };
  const created = data as { room_id: string; join_code?: string };
  const { data: room, error: roomError } = await member.admin
    .from("game_rooms")
    .select("id, join_code")
    .eq("id", created.room_id)
    .maybeSingle();
  if (roomError) return { error: roomError.message };
  const joinCode = (room?.join_code as string | undefined) ?? created.join_code;
  if (!joinCode) return { error: "The game room has no code yet." };
  const { error: saveError } = await member.admin
    .from("community_room_activities")
    .update({ payload: { ...payload, gameRoomId: created.room_id, joinCode } })
    .eq("id", activityId);
  if (saveError) return { error: saveError.message };
  refresh();
  return { ok: true as const, href: `/dashboard/group-games/room/${created.room_id}` };
}
