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
