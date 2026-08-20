"use server";

import { revalidatePath } from "next/cache";
import {
  appliesBeginnersRescheduleLimit,
  getBeginnersRescheduleLockedReason,
  loadBeginnersRescheduleLimitStatus,
} from "@/lib/calendar/reschedule-limit";
import { getRescheduleEligibility } from "@/lib/calendar/reschedule-policy";
import { assertValidRescheduleSlot } from "@/lib/calendar/reschedule-slots";
import {
  buildSessionRebookPaymentUrl,
} from "@/lib/stripe/session-rebook-checkout";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

export type SessionRebookActionResult = {
  error?: string;
  checkoutUrl?: string;
};

export async function startPaidSessionRebook(params: {
  sessionId: string;
  startsAt: string;
  endsAt: string;
}): Promise<SessionRebookActionResult> {
  const sessionId = params.sessionId.trim();
  const startsAt = params.startsAt.trim();
  const endsAt = params.endsAt.trim();
  if (!sessionId) return { error: "Missing lesson." };
  if (!startsAt || !endsAt) return { error: "Choose a new time at least 48 hours ahead." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!user.email) return { error: "Your account needs an email for checkout." };

  const { data: session, error: sessionError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) return { error: "Lesson not found." };
  if (session.cohort_id) {
    return { error: "Group lessons cannot use paid 1-to-1 rebook." };
  }
  if (session.student_id !== user.id) {
    return { error: "This lesson is not on your schedule." };
  }

  const { data: existing } = await supabase
    .from("lesson_reschedule_requests")
    .select("*")
    .eq("session_id", sessionId)
    .eq("student_id", user.id)
    .maybeSingle();

  const beginnersRescheduleLimit = await loadBeginnersRescheduleLimitStatus(supabase, user.id);
  const rescheduleLimitLockedReason = appliesBeginnersRescheduleLimit(
    session,
    beginnersRescheduleLimit
  )
    ? getBeginnersRescheduleLockedReason(session, beginnersRescheduleLimit)
    : null;

  const eligibility = getRescheduleEligibility(session, existing ?? null, {
    rescheduleLimitLockedReason,
  });
  if (!eligibility.canRequest) {
    return { error: eligibility.lockedReason ?? "Cannot rebook this lesson." };
  }
  if (!eligibility.isLateCancel) {
    return {
      error:
        "Paid rebook is only for lessons inside the 48-hour window. Use free reschedule instead.",
    };
  }

  const slotCheck = await assertValidRescheduleSlot(
    supabase,
    session,
    user.id,
    startsAt,
    endsAt
  );
  if (!slotCheck.ok) return { error: slotCheck.error };

  const { client: admin, error: adminError } = tryCreateServiceRoleClient();
  if (!admin) return { error: adminError };

  // Expire older pending rows for this session so students don't pay against a stale hold.
  await admin
    .from("pending_rebookings")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("original_session_id", sessionId)
    .eq("student_profile_id", user.id)
    .eq("status", "pending");

  const { data: pending, error: insertError } = await admin
    .from("pending_rebookings")
    .insert({
      student_profile_id: user.id,
      tutor_profile_id: session.tutor_id,
      original_session_id: sessionId,
      proposed_start_time: startsAt,
      proposed_end_time: endsAt,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    if (
      insertError.message.includes("pending_rebookings") ||
      insertError.message.toLowerCase().includes("schema cache")
    ) {
      return {
        error:
          "Paid rebook storage is not applied yet. Apply supabase/pending-rebookings.sql in production first.",
      };
    }
    return { error: insertError.message };
  }

  revalidatePath("/dashboard/schedule");
  return {
    checkoutUrl: buildSessionRebookPaymentUrl({
      pendingRebookingId: pending.id as string,
      studentEmail: user.email,
    }),
  };
}
