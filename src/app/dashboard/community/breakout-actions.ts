"use server";

import { revalidatePath } from "next/cache";
import { buildRoomContentSettings } from "@/lib/group-games/content-filters";
import { signRoomActivity, topicFor, voteInDebate } from "@/lib/community/breakout";
import { GROUP_GAMES_WITH_TOPIC_FILTER } from "@/lib/group-games/content-filters";
import type { GroupGameType } from "@/lib/game-rooms/types";
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


/** Bonus-round games the room can pick from. All of them filter to this week's topic. */
const BONUS_GAMES: GroupGameType[] = ["point_race", "buzz_in", "jeopardy", "sentence_builder_group"];

/**
 * Bonus round: the room's host picks a game and it is created on this week's topic.
 * Everyone else (and the host, on a second tap) joins that same game by its code.
 */
export async function openBonusGame(activityId: string, gameType?: GroupGameType) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const { data: activity, error } = await member.admin
    .from("community_room_activities")
    .select("id, kind, payload, status, room_id")
    .eq("id", activityId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!activity || activity.kind !== "bonus" || activity.status !== "active") return { error: "The bonus round is not open." };

  type BonusPayload = { topicTags?: string[]; gameRoomId?: string | null; joinCode?: string | null; gameType?: GroupGameType | null };
  const payload = (activity.payload ?? {}) as BonusPayload;
  const supabase = await createClient();

  if (payload.gameRoomId && payload.joinCode) {
    const { error: joinError } = await supabase.rpc("join_game_room", { p_join_code: payload.joinCode });
    if (joinError && !joinError.message.toLowerCase().includes("already")) {
      return { error: joinError.message, href: `/dashboard/group-games/room/${payload.gameRoomId}` };
    }
    return { ok: true as const, href: `/dashboard/group-games/room/${payload.gameRoomId}` };
  }

  if (!gameType || !BONUS_GAMES.includes(gameType)) return { error: "Pick a game first." };

  // This week's topic: from the plan, or looked up for rooms planned before topics were stored.
  let topicTags = payload.topicTags ?? [];
  if (topicTags.length === 0) {
    const { data: room } = await member.admin.from("community_rooms").select("occurrence_id").eq("id", activity.room_id).maybeSingle();
    if (room?.occurrence_id) topicTags = (await topicFor(member.admin, room.occurrence_id as string)).topicTags.slice(0, 8);
  }

  const settings = buildRoomContentSettings({
    questionCount: 10,
    gameType,
    topicTags: GROUP_GAMES_WITH_TOPIC_FILTER.has(gameType) ? topicTags : [],
  });
  const { data, error: createError } = await supabase.rpc("create_game_room", { p_game_type: gameType, p_settings: settings });
  if (createError) return { error: createError.message };
  const created = data as { room_id: string; join_code?: string };
  const { data: gameRoom } = await member.admin.from("game_rooms").select("join_code").eq("id", created.room_id).maybeSingle();
  const joinCode = (gameRoom?.join_code as string | undefined) ?? created.join_code;
  if (!joinCode) return { error: "The game room has no code yet." };

  // If someone else created a game in the same moment, use theirs so the room stays together.
  const { data: latest } = await member.admin.from("community_room_activities").select("payload").eq("id", activityId).maybeSingle();
  const latestPayload = (latest?.payload ?? {}) as BonusPayload;
  if (latestPayload.gameRoomId && latestPayload.joinCode) {
    await member.admin.from("game_rooms").update({ status: "cancelled" }).eq("id", created.room_id);
    await supabase.rpc("join_game_room", { p_join_code: latestPayload.joinCode });
    return { ok: true as const, href: `/dashboard/group-games/room/${latestPayload.gameRoomId}` };
  }

  const { error: saveError } = await member.admin
    .from("community_room_activities")
    .update({ payload: { ...latestPayload, topicTags, gameRoomId: created.room_id, joinCode, gameType } })
    .eq("id", activityId);
  if (saveError) return { error: saveError.message };
  refresh();
  return { ok: true as const, href: `/dashboard/group-games/room/${created.room_id}` };
}


/** Main room: joins the whole-group game the host started. */
export async function joinGroupGame(occurrenceId: string) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const { data: occurrence, error } = await member.admin
    .from("community_session_occurrences")
    .select("status, group_game")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (error) return { error: error.message };
  const game = occurrence?.group_game as { gameRoomId?: string; joinCode?: string } | null;
  if (occurrence?.status !== "live" || !game?.gameRoomId || !game.joinCode) return { error: "There's no group game running." };
  const supabase = await createClient();
  const { error: joinError } = await supabase.rpc("join_game_room", { p_join_code: game.joinCode });
  if (joinError && !joinError.message.toLowerCase().includes("already")) {
    return { error: joinError.message, href: `/dashboard/group-games/room/${game.gameRoomId}` };
  }
  return { ok: true as const, href: `/dashboard/group-games/room/${game.gameRoomId}` };
}
