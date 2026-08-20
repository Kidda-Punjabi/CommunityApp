import "server-only";

import { applyRescheduleSlotToSession } from "@/lib/calendar/tutor-cover";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import { sendSessionRebookConfirmationEmails } from "@/lib/email/send-session-rebook-confirmation";
import { getDisplayName } from "@/lib/profile/display-name";
import {
  assertSessionRebookPayment,
  isSessionRebookCheckout,
} from "@/lib/stripe/session-rebook-checkout";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type Stripe from "stripe";

type PendingRebookingRow = {
  id: string;
  student_profile_id: string;
  tutor_profile_id: string;
  original_session_id: string;
  proposed_start_time: string;
  proposed_end_time: string;
  status: string;
  stripe_checkout_session_id: string | null;
};

async function markFailed(
  admin: ReturnType<typeof createServiceRoleClient>,
  id: string,
  reason: string
) {
  console.error("[session-rebook] failure:", id, reason);
  await admin
    .from("pending_rebookings")
    .update({
      status: "failed",
      failure_reason: reason.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["pending", "paid", "failed"]);
}

async function recordCountableReschedule(
  admin: ReturnType<typeof createServiceRoleClient>,
  pending: PendingRebookingRow
) {
  const preferred = formatSessionWhen(
    pending.proposed_start_time,
    pending.proposed_end_time
  );

  const { data: existing } = await admin
    .from("lesson_reschedule_requests")
    .select("id, status")
    .eq("session_id", pending.original_session_id)
    .eq("student_id", pending.student_profile_id)
    .maybeSingle();

  const payload = {
    session_id: pending.original_session_id,
    student_id: pending.student_profile_id,
    message: "Paid £35 session rebook (under 48-hour notice).",
    preferred_times: preferred,
    requested_starts_at: pending.proposed_start_time,
    requested_ends_at: pending.proposed_end_time,
    status: "approved" as const,
    tutor_response: "Auto-approved after verified £35 rebook payment.",
    resolved_at: new Date().toISOString(),
    resolved_by: null,
  };

  if (existing?.id) {
    const { error } = await admin
      .from("lesson_reschedule_requests")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("lesson_reschedule_requests").insert(payload);
  if (error) throw error;
}

/**
 * Isolated Session Rebook handler. Returns true when this event was for the
 * Session Rebook payment link (so the main webhook can skip other grant paths).
 */
export async function handleSessionRebookWebhookEvent(
  event: Stripe.Event
): Promise<boolean> {
  if (event.type !== "checkout.session.completed") return false;

  const session = event.data.object as Stripe.Checkout.Session;
  if (!(await isSessionRebookCheckout(session))) return false;

  const admin = createServiceRoleClient();
  const pendingId = session.client_reference_id?.trim() || null;
  if (!pendingId) {
    console.error(
      "[session-rebook] checkout.session.completed missing client_reference_id",
      session.id
    );
    return true;
  }

  const { data: pending, error: loadError } = await admin
    .from("pending_rebookings")
    .select(
      "id, student_profile_id, tutor_profile_id, original_session_id, proposed_start_time, proposed_end_time, status, stripe_checkout_session_id"
    )
    .eq("id", pendingId)
    .maybeSingle();

  if (loadError) {
    console.error("[session-rebook] lookup failed:", loadError.message, pendingId);
    return true;
  }
  if (!pending) {
    console.error("[session-rebook] pending_rebookings row not found:", pendingId);
    return true;
  }

  const row = pending as PendingRebookingRow;

  // Idempotent: already booked — do not double-book or re-email.
  if (row.status === "booked") {
    return true;
  }

  const paymentCheck = assertSessionRebookPayment(session);
  if (!paymentCheck.ok) {
    await markFailed(admin, row.id, paymentCheck.error);
    return true;
  }

  const now = new Date().toISOString();
  const { error: paidError } = await admin
    .from("pending_rebookings")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id,
      failure_reason: null,
      updated_at: now,
    })
    .eq("id", row.id)
    .in("status", ["pending", "paid", "failed"]);

  if (paidError) {
    console.error("[session-rebook] mark paid failed:", paidError.message, row.id);
    return true;
  }

  const applied = await applyRescheduleSlotToSession(admin, {
    sessionId: row.original_session_id,
    startsAt: row.proposed_start_time,
    endsAt: row.proposed_end_time,
  });

  if (!applied.ok) {
    await markFailed(
      admin,
      row.id,
      `Payment verified but calendar booking failed: ${applied.error}`
    );
    return true;
  }

  try {
    await recordCountableReschedule(admin, row);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(
      admin,
      row.id,
      `Payment verified and calendar moved, but reschedule log failed: ${message}`
    );
    return true;
  }

  const { error: bookedError } = await admin
    .from("pending_rebookings")
    .update({
      status: "booked",
      stripe_checkout_session_id: session.id,
      booked_at: now,
      failure_reason: null,
      updated_at: now,
    })
    .eq("id", row.id);

  if (bookedError) {
    console.error("[session-rebook] mark booked failed:", bookedError.message, row.id);
    // Calendar already moved — leave as paid for reconciliation.
    return true;
  }

  try {
    const [{ data: student }, { data: tutor }, { data: lesson }, studentAuth, tutorAuth] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, full_name, preferred_name")
          .eq("id", row.student_profile_id)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("id, full_name, preferred_name")
          .eq("id", row.tutor_profile_id)
          .maybeSingle(),
        admin
          .from("tutor_scheduled_sessions")
          .select("title, starts_at, ends_at, meet_link")
          .eq("id", row.original_session_id)
          .maybeSingle(),
        admin.auth.admin.getUserById(row.student_profile_id),
        admin.auth.admin.getUserById(row.tutor_profile_id),
      ]);

    await sendSessionRebookConfirmationEmails({
      studentEmail:
        studentAuth.data.user?.email ??
        session.customer_details?.email ??
        session.customer_email ??
        null,
      tutorEmail: tutorAuth.data.user?.email ?? null,
      studentName: student ? getDisplayName(student) ?? "Student" : "Student",
      tutorName: tutor ? getDisplayName(tutor) ?? "Tutor" : "Tutor",
      lessonTitle: (lesson?.title as string | null) ?? "1-to-1 lesson",
      startsAt: row.proposed_start_time,
      endsAt: row.proposed_end_time,
      meetLink: (lesson?.meet_link as string | null) ?? null,
    });
  } catch (error) {
    console.error(
      "[session-rebook] booking succeeded but email failed:",
      row.id,
      error instanceof Error ? error.message : error
    );
  }

  return true;
}
