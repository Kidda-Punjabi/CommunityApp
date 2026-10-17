"use server";

import { revalidatePath } from "next/cache";
import { requireCommunityStaff } from "@/lib/community/member-guard";
import { syncCommunityCalendarGuest } from "@/lib/community/calendar-invite";
import {
  assignMemberPod,
  checkInMember,
  chooseMainSession,
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

export async function approveSessionSwitch(requestId: string) {
  const { admin, userId } = await staff();
  const { data: request, error } = await admin
    .from("community_session_switch_requests")
    .select("id, user_id, to_session_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !request || request.status !== "pending") return { error: "That request is not waiting." };
  const moved = await chooseMainSession(admin, request.user_id as string, request.to_session_id as string);
  if ("error" in moved && moved.error) return moved;
  await assignMemberPod(admin, request.user_id as string);
  await admin.from("community_session_switch_requests").update({
    status: "approved",
    reviewed_at: new Date().toISOString(),
    reviewed_by: userId,
  }).eq("id", requestId);
  revalidatePath("/admin/community/switches");
  return { ok: true as const };
}

export async function retryCalendarInvite(memberId: string) {
  const { admin } = await staff();
  const { data } = await admin.from("community_memberships_meta").select("main_session_id").eq("user_id", memberId).maybeSingle();
  const result = await syncCommunityCalendarGuest(admin, memberId, null, (data?.main_session_id as string | null) ?? null);
  revalidatePath("/admin/community/invites");
  return result;
}
