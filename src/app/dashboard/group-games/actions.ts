"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_QUESTION_COUNT, GROUP_GAME_TYPES } from "@/lib/game-rooms/constants";
import type { GroupGameType } from "@/lib/game-rooms/types";
import {
  buildRoomContentSettings,
  parseTopicTagsFromForm,
} from "@/lib/group-games/content-filters";
import { ensureBuzzInInitialized } from "@/lib/buzz-in/load-buzz-in";
import { ensureJeopardyInitialized } from "@/lib/jeopardy/load-jeopardy";
import { ensureLadderInitialized } from "@/lib/chado-pauri-group/load-ladder";
import { ensureSentenceBuilderInitialized } from "@/lib/sentence-builder-group/load-sentence";
import { ensurePointRaceInitialized } from "@/lib/point-race/load-race";
import { loadGameRoom } from "@/lib/game-rooms/load-room";
import { rejectIfKidCommunityBlocked } from "@/lib/kids/guards";
import { createClient } from "@/lib/supabase/server";

export type GroupGameActionResult = { error?: string; roomId?: string };

function isGroupGameType(value: string): value is GroupGameType {
  return (GROUP_GAME_TYPES as readonly string[]).includes(value);
}

export async function createGameRoom(
  _prev: GroupGameActionResult,
  formData: FormData
): Promise<GroupGameActionResult> {
  const gameType = String(formData.get("game_type") ?? "").trim();
  const questionCountRaw = String(formData.get("question_count") ?? "10").trim();
  const questionCount = Number.parseInt(questionCountRaw, 10);
  const topicTags = parseTopicTagsFromForm(formData.get("topic_tags"));

  if (!isGroupGameType(gameType)) {
    return { error: "Pick a group game type." };
  }

  if (!Number.isFinite(questionCount) || questionCount < 1 || questionCount > 50) {
    return { error: "Question count must be between 1 and 50." };
  }

  const settings = buildRoomContentSettings({
    questionCount,
    gameType,
    topicTags,
  });

  const access = await rejectIfKidCommunityBlocked();
  if (access.blocked) return { error: access.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_game_room", {
    p_game_type: gameType,
    p_settings: settings,
  });

  if (error) return { error: error.message };

  const payload = data as { room_id: string };
  revalidatePath("/dashboard/group-games");
  redirect(`/dashboard/group-games/room/${payload.room_id}`);
}

export async function joinGameRoomByCode(
  _prev: GroupGameActionResult,
  formData: FormData
): Promise<GroupGameActionResult> {
  const code = String(formData.get("join_code") ?? "").trim();
  if (!code) return { error: "Enter a room code." };

  const access = await rejectIfKidCommunityBlocked();
  if (access.blocked) return { error: access.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_game_room", {
    p_join_code: code,
  });

  if (error) return { error: error.message };

  const payload = data as { room_id: string };
  revalidatePath("/dashboard/group-games");
  redirect(`/dashboard/group-games/room/${payload.room_id}`);
}

export async function setHostPlaying(
  roomId: string,
  isPlaying: boolean
): Promise<GroupGameActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_game_room_host_playing", {
    p_room_id: roomId,
    p_is_playing: isPlaying,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/group-games/room/${roomId}`);
  return { roomId };
}

export async function startGameRoom(roomId: string): Promise<GroupGameActionResult> {
  const supabase = await createClient();
  const room = await loadGameRoom(supabase, roomId);

  const { error } = await supabase.rpc("start_game_room", {
    p_room_id: roomId,
  });

  if (error) return { error: error.message };

  if (room?.game_type === "buzz_in") {
    const startedRoom = (await loadGameRoom(supabase, roomId)) ?? room;
    try {
      await ensureBuzzInInitialized(supabase, { ...startedRoom, status: "in_progress" });
    } catch (initError) {
      const message = initError instanceof Error ? initError.message : "Failed to initialize game.";
      return { error: message };
    }
  }

  if (room?.game_type === "jeopardy") {
    const startedRoom = (await loadGameRoom(supabase, roomId)) ?? room;
    try {
      await ensureJeopardyInitialized(supabase, { ...startedRoom, status: "in_progress" });
    } catch (initError) {
      const message = initError instanceof Error ? initError.message : "Failed to initialize game.";
      return { error: message };
    }
  }

  if (room?.game_type === "chado_pauri_group") {
    const startedRoom = (await loadGameRoom(supabase, roomId)) ?? room;
    try {
      await ensureLadderInitialized(supabase, { ...startedRoom, status: "in_progress" });
    } catch (initError) {
      const message = initError instanceof Error ? initError.message : "Failed to initialize game.";
      return { error: message };
    }
  }

  if (room?.game_type === "sentence_builder_group") {
    const startedRoom = (await loadGameRoom(supabase, roomId)) ?? room;
    try {
      await ensureSentenceBuilderInitialized(supabase, { ...startedRoom, status: "in_progress" });
    } catch (initError) {
      const message = initError instanceof Error ? initError.message : "Failed to initialize game.";
      return { error: message };
    }
  }

  if (room?.game_type === "point_race") {
    const startedRoom = (await loadGameRoom(supabase, roomId)) ?? room;
    try {
      await ensurePointRaceInitialized(supabase, { ...startedRoom, status: "in_progress" });
    } catch (initError) {
      const message = initError instanceof Error ? initError.message : "Failed to initialize game.";
      return { error: message };
    }
  }

  revalidatePath(`/dashboard/group-games/room/${roomId}`);
  return { roomId };
}

export async function leaveGameRoom(roomId: string): Promise<GroupGameActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_game_room", {
    p_room_id: roomId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/group-games");
  return { roomId };
}

export async function resetGameRoomToLobby(input: {
  roomId: string;
  gameType?: GroupGameType;
  questionCount?: number;
  topicTags?: string[];
}): Promise<GroupGameActionResult> {
  const supabase = await createClient();
  const room = await loadGameRoom(supabase, input.roomId);
  if (!room) return { error: "Room not found." };

  const nextType = input.gameType ?? room.game_type;
  if (!isGroupGameType(nextType)) {
    return { error: "Pick a group game type." };
  }

  const questionCount = input.questionCount ?? room.settings?.question_count ?? DEFAULT_QUESTION_COUNT;
  const topicTags = input.topicTags ?? room.settings?.topic_tags ?? [];
  const settings = buildRoomContentSettings({
    questionCount:
      typeof questionCount === "number" && Number.isFinite(questionCount)
        ? questionCount
        : DEFAULT_QUESTION_COUNT,
    gameType: nextType,
    topicTags: Array.isArray(topicTags) ? topicTags : [],
  });

  const { error } = await supabase.rpc("reset_game_room_to_lobby", {
    p_room_id: input.roomId,
    p_game_type: nextType,
    p_settings: settings,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/group-games/room/${input.roomId}`);
  revalidatePath(`/dashboard/group-games/room/${input.roomId}/play`);
  return { roomId: input.roomId };
}
