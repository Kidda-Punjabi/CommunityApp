"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncCommunityCalendarGuest } from "@/lib/community/calendar-invite";
import { requireCommunityMember } from "@/lib/community/member-guard";
import { checkInByCodeForMember, completeOccurrenceCheckIn } from "@/lib/community/check-in-by-code";
import { assignMemberPod, chooseMainSession } from "@/lib/community/mutations";

export async function pickMainSession(sessionId: string) {
  const started = Date.now();
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const result = await chooseMainSession(member.admin, member.userId, sessionId, { invite: "later" });
  if ("error" in result && result.error) return result;
  if (result.changed) {
    const admin = member.admin;
    const userId = member.userId;
    const previous = result.previous;
    after(async () => {
      await syncCommunityCalendarGuest(admin, userId, previous, sessionId);
    });
  }
  revalidatePath("/dashboard/community");
  console.info(`[community] pickMainSession action ${Date.now() - started}ms`);
  return { ok: true as const, calendarInvite: !result.changed };
}

export async function requestSessionSwitch(sessionId: string, reason: string) {
  const started = Date.now();
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const { data: meta, error } = await member.admin
    .from("community_memberships_meta")
    .select("main_session_id")
    .eq("user_id", member.userId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!meta?.main_session_id) return { error: "Pick a main session first." };
  if (meta.main_session_id === sessionId) return { error: "That is already your main session." };
  const { error: insertError } = await member.admin.from("community_session_switch_requests").insert({
    user_id: member.userId,
    from_session_id: meta.main_session_id,
    to_session_id: sessionId,
    reason: reason.trim() || null,
  });
  if (insertError) return { error: insertError.message };
  console.info(`[community] requestSessionSwitch ${Date.now() - started}ms`);
  return { ok: true as const };
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
  const result = await completeOccurrenceCheckIn(member.admin, member.userId, occurrenceId, code);
  if ("ok" in result && result.ok) {
    revalidatePath("/dashboard/community");
    revalidatePath("/dashboard/learn");
    revalidatePath("/dashboard/community/check-in");
  }
  return result;
}

export async function checkInByCode(code: string) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const result = await checkInByCodeForMember(member.admin, member.userId, code);
  if ("ok" in result && result.ok) {
    revalidatePath("/dashboard/community");
    revalidatePath("/dashboard/learn");
    revalidatePath("/dashboard/community/check-in");
  }
  return result;
}
