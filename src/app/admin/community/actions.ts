"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCommunityStaff } from "@/lib/community/member-guard";
import { syncCommunityCalendarGuest } from "@/lib/community/calendar-invite";
import { setMemberLevel as writeMemberLevel } from "@/lib/community/level-move";
import {
  assignMemberPod,
  checkInMember,
  chooseMainSession,
  endCommunitySession,
  setOccurrenceWeek,
  startCommunitySession,
  startTestCommunitySession,
} from "@/lib/community/mutations";

async function staff() {
  const result = await requireCommunityStaff();
  if ("error" in result) throw new Error(result.error);
  return result;
}

function revalidateHost() {
  revalidatePath("/admin/community/today");
  revalidatePath("/admin/community/session/[id]", "page");
}

/** Starts the session and opens its live session page. */
export async function startSession(occurrenceId: string) {
  const { admin, userId } = await staff();
  const result = await startCommunitySession(admin, userId, occurrenceId);
  revalidateHost();
  if ("ok" in result && result.ok) redirect(`/admin/community/session/${occurrenceId}`);
  return result;
}

/** Starts a staff-only test session and opens its live session page. */
export async function startTestSession(week: number) {
  const { admin, userId } = await staff();
  const result = await startTestCommunitySession(admin, userId, week);
  revalidateHost();
  if ("ok" in result && result.ok) redirect(`/admin/community/session/${result.occurrenceId}`);
  return result;
}

export async function endSession(occurrenceId: string) {
  const { admin } = await staff();
  const result = await endCommunitySession(admin, occurrenceId);
  const { closeBreakoutRooms } = await import("@/lib/community/breakout");
  await closeBreakoutRooms(admin, occurrenceId);
  revalidateHost();
  revalidatePath("/dashboard/community");
  return result;
}

export async function overrideWeek(occurrenceId: string, week: number) {
  const { admin } = await staff();
  const result = await setOccurrenceWeek(admin, occurrenceId, week);
  revalidateHost();
  return result;
}

export async function addCheckIn(occurrenceId: string, email: string) {
  const { admin } = await staff();
  const { data, error } = await admin.rpc("community_find_user_by_email", { p_email: email });
  if (error) return { error: error.message };
  if (!data) return { error: "No member with that email." };
  const result = await checkInMember(admin, data as string, occurrenceId, "", true);
  if ("ok" in result && result.ok) {
    const { placeLateCheckIn } = await import("@/lib/community/breakout");
    try {
      await placeLateCheckIn(admin, occurrenceId, data as string);
    } catch (error) {
      console.error("[community] late room suggestion failed", error);
    }
  }
  revalidateHost();
  revalidatePath("/dashboard/community");
  return result;
}

export async function setMemberLevel(userId: string, level: number, reason: string) {
  const { admin, userId: actorId } = await staff();
  const result = await writeMemberLevel(admin, actorId, userId, level, reason);
  revalidatePath("/admin/community/not-placed");
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
