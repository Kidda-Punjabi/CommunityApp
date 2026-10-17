"use server";

import { revalidatePath } from "next/cache";
import { requireCommunityStaff } from "@/lib/community/member-guard";
import {
  assignMemberPod,
  checkInMember,
  endCommunitySession,
  setOccurrenceWeek,
  startCommunitySession,
} from "@/lib/community/mutations";

async function staff() {
  const result = await requireCommunityStaff();
  if ("error" in result) throw new Error(result.error);
  return result;
}

export async function startSession(occurrenceId: string) {
  const { admin, userId } = await staff();
  const result = await startCommunitySession(admin, userId, occurrenceId);
  revalidatePath("/admin/community/today");
  return result;
}

export async function endSession(occurrenceId: string) {
  const { admin } = await staff();
  const result = await endCommunitySession(admin, occurrenceId);
  revalidatePath("/admin/community/today");
  return result;
}

export async function overrideWeek(occurrenceId: string, week: number) {
  const { admin } = await staff();
  const result = await setOccurrenceWeek(admin, occurrenceId, week);
  revalidatePath("/admin/community/today");
  return result;
}

export async function addCheckIn(occurrenceId: string, email: string) {
  const { admin } = await staff();
  const { data, error } = await admin.rpc("community_find_user_by_email", { p_email: email });
  if (error) return { error: error.message };
  if (!data) return { error: "No member with that email." };
  const result = await checkInMember(admin, data as string, occurrenceId, "", true);
  revalidatePath("/admin/community/today");
  return result;
}

export async function suggestPod(userId: string) {
  const { admin } = await staff();
  const result = await assignMemberPod(admin, userId);
  revalidatePath("/admin/community/not-placed");
  return result;
}
