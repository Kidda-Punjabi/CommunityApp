import "server-only";

import { createOneToOneCalendarSession } from "@/lib/tutoring/one-to-one-calendar-booking";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ONE_TO_ONE_SLOT_HOLD_MINUTES = 20;

/** Cancel abandoned pending_payment holds so slots reopen. */
export async function expireStalePendingOneToOneBookings(
  supabase: SupabaseClient,
  tutorId?: string
): Promise<void> {
  const cutoff = new Date(Date.now() - ONE_TO_ONE_SLOT_HOLD_MINUTES * 60 * 1000).toISOString();
  let query = supabase
    .from("tutor_one_to_one_bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("status", "pending_payment")
    .lt("created_at", cutoff);

  if (tutorId) {
    query = query.eq("tutor_id", tutorId);
  }

  await query;
}

/**
 * After Stripe pays for a session credit linked to a pending slot hold,
 * confirm the booking, consume the credit, and create the calendar invite.
 */
export async function confirmPendingOneToOneBookingAfterPayment(
  supabase: SupabaseClient,
  params: {
    userId: string;
    creditId: string;
    bookingId: string;
    studentEmail: string;
  }
): Promise<{ ok: true; meetLink?: string | null } | { ok: false; error: string }> {
  const { data: booking, error: bookingError } = await supabase
    .from("tutor_one_to_one_bookings")
    .select("id, tutor_id, student_id, starts_at, ends_at, status, notes")
    .eq("id", params.bookingId)
    .eq("student_id", params.userId)
    .maybeSingle();

  if (bookingError) return { ok: false, error: bookingError.message };
  if (!booking) return { ok: false, error: "Reserved lesson time not found." };

  if (booking.status === "confirmed") {
    return { ok: true };
  }

  if (booking.status !== "pending_payment") {
    return { ok: false, error: "That lesson time is no longer reserved." };
  }

  const { error: confirmError } = await supabase
    .from("tutor_one_to_one_bookings")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", booking.id)
    .eq("status", "pending_payment");

  if (confirmError) return { ok: false, error: confirmError.message };

  const { error: useCreditError } = await supabase
    .from("tutor_one_to_one_booking_credits")
    .update({
      status: "used",
      booking_id: booking.id,
      used_at: new Date().toISOString(),
    })
    .eq("id", params.creditId)
    .eq("student_id", params.userId)
    .eq("status", "available");

  if (useCreditError) {
    await supabase
      .from("tutor_one_to_one_bookings")
      .update({ status: "pending_payment", updated_at: new Date().toISOString() })
      .eq("id", booking.id);
    return { ok: false, error: useCreditError.message };
  }

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", params.userId)
    .maybeSingle();
  const studentName = studentProfile ? getDisplayName(studentProfile) : null;
  const lessonTitle = studentName
    ? `1-to-1 lesson with ${studentName}`
    : "1-to-1 Kidda lesson";

  const { data: settings } = await supabase
    .from("tutor_availability_settings")
    .select("timezone")
    .eq("tutor_id", booking.tutor_id)
    .maybeSingle();

  const { data: creditRow } = await supabase
    .from("tutor_one_to_one_booking_credits")
    .select("course_id")
    .eq("id", params.creditId)
    .maybeSingle();

  const calendarResult = await createOneToOneCalendarSession(supabase, {
    tutorId: booking.tutor_id as string,
    studentId: params.userId,
    studentEmail: params.studentEmail,
    startsAt: booking.starts_at as string,
    endsAt: booking.ends_at as string,
    courseId: (creditRow?.course_id as string | null) ?? null,
    title: lessonTitle,
    notes: (booking.notes as string) ?? null,
    timeZone: (settings?.timezone as string) ?? "Europe/London",
  });

  if (!calendarResult.ok) {
    console.error("confirmPendingOneToOneBooking calendar failed:", calendarResult.error);
    // Keep booking confirmed + credit used — payment succeeded; calendar can be fixed manually.
    return { ok: true, meetLink: null };
  }

  await supabase
    .from("tutor_one_to_one_bookings")
    .update({
      session_id: calendarResult.sessionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  return { ok: true, meetLink: calendarResult.meetLink ?? null };
}
