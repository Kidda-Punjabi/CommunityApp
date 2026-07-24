import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CancelConfirmedOneToOneBookingResult =
  | { ok: true; cancelledSessionId: string | null }
  | { ok: false; error: string };

/**
 * Cancel a confirmed 1-to-1 booking:
 * - restore the linked credit to available
 * - mark the linked tutor_scheduled_sessions row cancelled (Upcoming lessons)
 *
 * Google Calendar event cancel is a separate best-effort follow-up — callers
 * should schedule cancelOneToOneSessionGoogleCalendarEvent after this returns
 * (e.g. via next/server `after`), never inside this DB path.
 */
export async function cancelConfirmedOneToOneBooking(
  admin: SupabaseClient,
  params: { bookingId: string; studentId: string }
): Promise<CancelConfirmedOneToOneBookingResult> {
  const { data: booking, error: bookingError } = await admin
    .from("tutor_one_to_one_bookings")
    .select("id, status, session_id, student_id")
    .eq("id", params.bookingId)
    .eq("student_id", params.studentId)
    .maybeSingle();

  if (bookingError) return { ok: false, error: bookingError.message };
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.status !== "confirmed") {
    return { ok: false, error: "This booking cannot be cancelled here." };
  }

  const now = new Date().toISOString();

  const { error: cancelError } = await admin
    .from("tutor_one_to_one_bookings")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", booking.id)
    .eq("student_id", params.studentId)
    .eq("status", "confirmed");

  if (cancelError) return { ok: false, error: cancelError.message };

  const { error: creditError } = await admin
    .from("tutor_one_to_one_booking_credits")
    .update({
      status: "available",
      booking_id: null,
      used_at: null,
    })
    .eq("booking_id", booking.id)
    .eq("student_id", params.studentId)
    .eq("status", "used");

  if (creditError) {
    console.error("[one-to-one] restore credit after cancel failed:", creditError.message);
  }

  let cancelledSessionId: string | null = null;

  if (booking.session_id) {
    cancelledSessionId = booking.session_id as string;
    const { error: sessionError } = await admin
      .from("tutor_scheduled_sessions")
      .update({
        status: "cancelled",
        updated_at: now,
      })
      .eq("id", booking.session_id)
      .eq("status", "scheduled");

    if (sessionError) {
      console.error(
        "[one-to-one] cascade cancel to tutor_scheduled_sessions failed:",
        sessionError.message,
        "session=",
        booking.session_id
      );
    }
  }

  return { ok: true, cancelledSessionId };
}

/** Restore credits orphaned on already-cancelled bookings (data repair). */
export async function restoreCreditsForCancelledBookings(
  admin: SupabaseClient,
  bookingIds?: string[]
): Promise<{ restored: string[]; errors: string[] }> {
  let query = admin
    .from("tutor_one_to_one_booking_credits")
    .select("id, booking_id, status")
    .eq("status", "used")
    .not("booking_id", "is", null);

  if (bookingIds?.length) {
    query = query.in("booking_id", bookingIds);
  }

  const { data: credits, error } = await query;
  if (error) return { restored: [], errors: [error.message] };

  const restored: string[] = [];
  const errors: string[] = [];

  for (const credit of credits ?? []) {
    const bookingId = credit.booking_id as string;
    const { data: booking } = await admin
      .from("tutor_one_to_one_bookings")
      .select("id, status, session_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking || booking.status !== "cancelled") continue;

    const { error: updateError } = await admin
      .from("tutor_one_to_one_booking_credits")
      .update({
        status: "available",
        booking_id: null,
        used_at: null,
      })
      .eq("id", credit.id)
      .eq("status", "used");

    if (updateError) {
      errors.push(`${credit.id}: ${updateError.message}`);
      continue;
    }

    restored.push(credit.id as string);

    if (booking.session_id) {
      await admin
        .from("tutor_scheduled_sessions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", booking.session_id)
        .eq("status", "scheduled");
    }
  }

  return { restored, errors };
}
