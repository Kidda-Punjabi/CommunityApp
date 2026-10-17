"use server";

import { revalidatePath } from "next/cache";
import { requireCommunityMember } from "@/lib/community/member-guard";
import { assignMemberPod, checkInMember, chooseMainSession } from "@/lib/community/mutations";

export async function pickMainSession(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const result = await chooseMainSession(member.admin, member.userId, sessionId);
  revalidatePath("/dashboard/community");
  return result;
}

export async function placeInPod() {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const result = await assignMemberPod(member.admin, member.userId);
  revalidatePath("/dashboard/community");
  return result;
}

export async function submitCheckIn(occurrenceId: string, code: string) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  return checkInMember(member.admin, member.userId, occurrenceId, code, false);
}
