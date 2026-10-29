"use server";

import { revalidatePath } from "next/cache";
import {
  approveBreakoutRooms,
  approveLateMember,
  moveBreakoutMember,
  skipRoomActivity,
  suggestBreakoutRooms,
} from "@/lib/community/breakout";
import { requireCommunityStaff } from "@/lib/community/member-guard";
import { flashcardInstruction } from "@/lib/community/room-activities";
import { FLASHCARD_CARD_TYPE_LABELS, parseFlashcardCardType } from "@/lib/flashcards/types";

function refresh() {
  revalidatePath("/admin/community/today");
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

/** Host picks which kind of flashcards a room does (Words / Sentences / Questions / Speak about). */
export async function setFlashcardActivityType(activityId: string, cardType: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const type = parseFlashcardCardType(cardType);
  if (!type) return { error: "Pick a card type." };
  const { data: activity, error } = await staff.admin
    .from("community_room_activities")
    .select("id, kind, status, payload")
    .eq("id", activityId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!activity || activity.kind !== "flashcards") return { error: "That isn't a flashcard activity." };
  if (activity.status === "done") return { error: "That room has already finished its flashcards." };
  const payload = (activity.payload ?? {}) as Record<string, unknown>;
  const { error: saveError } = await staff.admin
    .from("community_room_activities")
    .update({
      title: `Flashcards · ${FLASHCARD_CARD_TYPE_LABELS[type]}`,
      payload: { ...payload, cardType: type, instruction: flashcardInstruction(type) },
    })
    .eq("id", activityId);
  if (saveError) return { error: saveError.message };
  refresh();
  return { ok: true as const };
}
