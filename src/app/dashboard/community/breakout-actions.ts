"use server";

import { revalidatePath } from "next/cache";
import { buildRoomContentSettings } from "@/lib/group-games/content-filters";
import { signRoomActivity, skipDebateSpeaker, voteInDebate } from "@/lib/community/breakout";
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

export async function skipSpeaker(activityId: string, speakerId: string) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const result = await skipDebateSpeaker(member.admin, member.userId, speakerId, activityId);
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
  return openRoomGame(activityId, "point_race");
}

const BONUS_GAMES = ["buzz_in", "point_race", "sentence_builder_group"] as const;
export type BonusGameType = (typeof BONUS_GAMES)[number];

type RoomGamePayload = {
  topicTags?: string[];
  questionCount?: number;
  gameRoomId?: string | null;
  joinCode?: string | null;
  gameType?: string | null;
};

/**
 * Opens the shared game for a room activity. The first person to tap creates the
 * game room on the week's topic (and becomes its host); everyone after that joins
 * the same room by its code. Used by Point Race and the bonus round.
 */
export async function openRoomGame(activityId: string, gameType: BonusGameType) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  if (!(BONUS_GAMES as readonly string[]).includes(gameType)) return { error: "Pick a game." };
  const { data: activity, error } = await member.admin
    .from("community_room_activities")
    .select("id, kind, payload, status")
    .eq("id", activityId)
    .maybeSingle();
  if (error) return { error: error.message };
  const allowedKind = activity?.kind === "point_race" || activity?.kind === "bonus";
  if (!activity || !allowedKind || activity.status !== "active") {
    return { error: "This game is not open." };
  }
  if (activity.kind === "point_race" && gameType !== "point_race") {
    return { error: "This activity is Point Race." };
  }
  const payload = (activity.payload ?? {}) as RoomGamePayload;
  const supabase = await createClient();

  if (payload.gameRoomId && payload.joinCode) {
    const { data: existing } = await member.admin
      .from("game_rooms")
      .select("status")
      .eq("id", payload.gameRoomId)
      .maybeSingle();
    const live = existing?.status === "waiting" || existing?.status === "in_progress";
    if (live) {
      const { error: joinError } = await supabase.rpc("join_game_room", { p_join_code: payload.joinCode });
      if (joinError && !joinError.message.toLowerCase().includes("already")) {
        return { error: joinError.message, href: `/dashboard/group-games/room/${payload.gameRoomId}` };
      }
      return { ok: true as const, href: `/dashboard/group-games/room/${payload.gameRoomId}` };
    }
    // The last game finished (or was ended): fall through and start a fresh one.
  }

  let topicTags = payload.topicTags ?? [];
  if (gameType === "sentence_builder_group" && topicTags.length > 0) {
    // Few grammar sentences are tagged by topic yet; play untagged rather than fail.
    const { count } = await member.admin
      .from("grammar_sentences")
      .select("id", { count: "exact", head: true })
      .overlaps("topic_tags", topicTags);
    if (!count) topicTags = [];
  }

  const settings = buildRoomContentSettings({
    questionCount: payload.questionCount ?? 10,
    gameType,
    topicTags,
  });
  const { data, error: createError } = await supabase.rpc("create_game_room", {
    p_game_type: gameType,
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
    .update({ payload: { ...payload, gameRoomId: created.room_id, joinCode, gameType } })
    .eq("id", activityId);
  if (saveError) return { error: saveError.message };
  refresh();
  return { ok: true as const, href: `/dashboard/group-games/room/${created.room_id}` };
}
