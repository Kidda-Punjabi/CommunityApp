"use server";

import { revalidatePath } from "next/cache";
import {
  addRoomActivity,
  approveBreakoutRooms,
  bringEveryoneBack,
  moveRoomActivity,
  removeRoomActivity,
  reopenBreakoutRooms,
  replaceRoomActivity,
  saveGroupGame,
  topicFor,
  approveLateMember,
  moveBreakoutMember,
  skipRoomActivity,
  suggestBreakoutRooms,
} from "@/lib/community/breakout";
import { requireCommunityStaff } from "@/lib/community/member-guard";
import type { RoomActivityKind } from "@/lib/community/room-activities";
import { buildRoomContentSettings, GROUP_GAMES_WITH_TOPIC_FILTER } from "@/lib/group-games/content-filters";
import type { GroupGameType } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/server";

function refresh() {
  revalidatePath("/admin/community/today");
  revalidatePath("/admin/community/session/[id]", "page");
  revalidatePath("/dashboard/community");
}

export async function suggestRooms(occurrenceId: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await suggestBreakoutRooms(staff.admin, occurrenceId);
  refresh();
  return result;
}

export async function approveRooms(occurrenceId: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await approveBreakoutRooms(staff.admin, occurrenceId, staff.userId);
  refresh();
  return result;
}

export async function movePerson(occurrenceId: string, userId: string, target: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await moveBreakoutMember(
    staff.admin,
    occurrenceId,
    userId,
    target === "new" ? "new" : Number(target)
  );
  refresh();
  return result;
}

export async function approveLate(occurrenceId: string, userId: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await approveLateMember(staff.admin, occurrenceId, userId);
  refresh();
  return result;
}

export async function skipActivity(roomId: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await skipRoomActivity(staff.admin, roomId);
  refresh();
  return result;
}


export async function addActivity(roomId: string, kind: RoomActivityKind) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await addRoomActivity(staff.admin, roomId, kind);
  refresh();
  return result;
}

export async function replaceActivity(activityId: string, kind: RoomActivityKind) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await replaceRoomActivity(staff.admin, activityId, kind);
  refresh();
  return result;
}

export async function removeActivity(activityId: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await removeRoomActivity(staff.admin, activityId);
  refresh();
  return result;
}

export async function moveActivity(activityId: string, direction: "up" | "down") {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await moveRoomActivity(staff.admin, activityId, direction);
  refresh();
  return result;
}

export async function bringBack(occurrenceId: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await bringEveryoneBack(staff.admin, occurrenceId);
  refresh();
  return result;
}

export async function backToRooms(occurrenceId: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await reopenBreakoutRooms(staff.admin, occurrenceId);
  refresh();
  return result;
}

const GROUP_GAMES: GroupGameType[] = ["point_race", "buzz_in", "jeopardy", "sentence_builder_group"];

/** Starts one game for everyone in the main room, on this week's topic, with the host as game host. */
export async function startGroupGame(occurrenceId: string, gameType: GroupGameType) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  if (!GROUP_GAMES.includes(gameType)) return { error: "Pick one of the listed games." };
  const topic = await topicFor(staff.admin, occurrenceId);
  const settings = buildRoomContentSettings({
    questionCount: 10,
    gameType,
    topicTags: GROUP_GAMES_WITH_TOPIC_FILTER.has(gameType) ? topic.topicTags.slice(0, 8) : [],
  });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_game_room", { p_game_type: gameType, p_settings: settings });
  if (error) return { error: error.message };
  const created = data as { room_id: string; join_code?: string };
  const { data: gameRoom } = await staff.admin.from("game_rooms").select("join_code").eq("id", created.room_id).maybeSingle();
  const joinCode = (gameRoom?.join_code as string | undefined) ?? created.join_code;
  if (!joinCode) return { error: "The game room has no code yet." };
  await saveGroupGame(staff.admin, occurrenceId, { gameRoomId: created.room_id, joinCode, gameType });
  refresh();
  return { ok: true as const, href: `/dashboard/group-games/room/${created.room_id}` };
}

export async function stopGroupGame(occurrenceId: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await saveGroupGame(staff.admin, occurrenceId, null);
  refresh();
  return result;
}
