"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ONE_TO_ONE_SESSION_CHECKOUT_KEY, isCheckoutConfigured } from "@/lib/products/checkout";
import { syncBookingCreditFromCheckoutSession } from "@/lib/stripe/sync-booking-credit";
import {
  countAvailableBookingCredits,
  loadStudentBookingContext,
  loadTutorAvailability,
  loadTutorBusyBlocks,
} from "@/lib/tutoring/availability/load-availability";
import { generateBookableSlots } from "@/lib/tutoring/availability/slots";
import { isAvailabilitySchemaMissingError } from "@/lib/tutoring/availability/schema";
import { createOneToOneCalendarSession } from "@/lib/tutoring/one-to-one-calendar-booking";
import { getDisplayName } from "@/lib/profile/display-name";
import type { BookableSlot } from "@/lib/tutoring/availability/types";

export type BookingActionResult = { error?: string; success?: string; bookingId?: string };

export async function syncBookingPayment(sessionId: string): Promise<BookingActionResult> {
  try {
    const result = await syncBookingCreditFromCheckoutSession(sessionId);
    if (!result.granted) {
      return { error: "Payment not completed yet. Refresh in a moment if you just paid." };
    }
    // Do not revalidatePath here — this runs during /dashboard/schedule render
    // after Stripe redirects with ?session_id=. The page already loads fresh data.
    if (result.bookingConfirmed) {
      return {
        success: result.meetLink
          ? "Payment received — your lesson is booked! Check Upcoming lessons for your join link."
          : "Payment received — your lesson is booked! Check Upcoming lessons for the calendar invite.",
      };
    }
    return {
      success:
        "Payment received — your session credit is ready. Pick a time below if a slot wasn't reserved.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not verify payment." };
  }
}

export async function isOneToOneSessionCheckoutConfigured(): Promise<boolean> {
  return isCheckoutConfigured(ONE_TO_ONE_SESSION_CHECKOUT_KEY);
}

export async function fetchBookableSlots(tutorId: string): Promise<{
  slots: BookableSlot[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { slots: [], error: "Sign in to book a lesson." };

    const { context } = await loadStudentBookingContext(supabase, user.id);
    if (!context || context.tutorUnresolved || context.tutorId !== tutorId) {
      return { slots: [], error: "You are not enrolled for 1-to-1 with this tutor." };
    }
    if (!context.bookingEnabled || !context.settings) {
      return { slots: [], error: "Your tutor has not opened booking yet." };
    }

    const admin = createServiceRoleClient();
    const { expireStalePendingOneToOneBookings } = await import(
      "@/lib/tutoring/confirm-pending-one-to-one-booking"
    );
    await expireStalePendingOneToOneBookings(admin, tutorId);

    const availability = await loadTutorAvailability(supabase, tutorId);
    const rangeStart = new Date().toISOString();
    const rangeEnd = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
    const busyBlocks = await loadTutorBusyBlocks(supabase, tutorId, rangeStart, rangeEnd);

    const slots = generateBookableSlots(context.settings, availability.windows, busyBlocks);
    return { slots: slots.slice(0, 60) };
  } catch (e) {
    return { slots: [], error: e instanceof Error ? e.message : "Could not load available times." };
  }
}

/**
 * Hold a slot as pending_payment, then continue to Stripe for a 1-to-1 session purchase.
 */
export async function reserveSlotForPurchase(input: {
  tutorId: string;
  startsAt: string;
  endsAt: string;
}): Promise<BookingActionResult & { bookingId?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sign in to choose a lesson time." };

    const tutorId = input.tutorId.trim();
    const startsAt = input.startsAt.trim();
    const endsAt = input.endsAt.trim();
    if (!tutorId || !startsAt || !endsAt) {
      return { error: "Choose a time slot." };
    }

    const { context } = await loadStudentBookingContext(supabase, user.id);
    if (
      !context ||
      context.tutorUnresolved ||
      context.tutorId !== tutorId ||
      !context.settings ||
      !context.bookingEnabled
    ) {
      return { error: "You are not eligible to book with this tutor." };
    }

    const slotStart = new Date(startsAt).getTime();
    const earliest = Date.now() + context.settings.bookingBufferHours * 60 * 60 * 1000;
    if (slotStart < earliest) {
      return {
        error: `Bookings must be at least ${context.settings.bookingBufferHours} hours in advance.`,
      };
    }

    const admin = createServiceRoleClient();
    const { expireStalePendingOneToOneBookings } = await import(
      "@/lib/tutoring/confirm-pending-one-to-one-booking"
    );
    await expireStalePendingOneToOneBookings(admin, tutorId);

    // Drop this student's other unpaid holds so they don't stack.
    await admin
      .from("tutor_one_to_one_bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("student_id", user.id)
      .eq("status", "pending_payment");

    const busyBlocks = await loadTutorBusyBlocks(admin, tutorId, startsAt, endsAt);
    if (busyBlocks.length > 0) {
      return { error: "That time is no longer available. Please choose another slot." };
    }

    const availability = await loadTutorAvailability(supabase, tutorId);
    const validSlots = generateBookableSlots(context.settings, availability.windows, busyBlocks, {
      fromMs: slotStart - 24 * 60 * 60 * 1000,
      daysAhead: 2,
    });
    const isValid = validSlots.some((slot) => slot.startsAt === startsAt && slot.endsAt === endsAt);
    if (!isValid) {
      return { error: "That slot is outside your tutor's available hours." };
    }

    const { data, error } = await admin
      .from("tutor_one_to_one_bookings")
      .insert({
        tutor_id: tutorId,
        student_id: user.id,
        starts_at: startsAt,
        ends_at: endsAt,
        status: "pending_payment",
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { error: "That time was just taken. Please choose another slot." };
      }
      return { error: error.message };
    }

    return {
      bookingId: data.id as string,
      success: "Time reserved — continue to payment to confirm your lesson.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reserve that time." };
  }
}

export async function createOneToOneBooking(
  _prev: BookingActionResult,
  formData: FormData
): Promise<BookingActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sign in to book a lesson." };

    const tutorId = String(formData.get("tutor_id") ?? "").trim();
    const startsAt = String(formData.get("starts_at") ?? "").trim();
    const endsAt = String(formData.get("ends_at") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!tutorId || !startsAt || !endsAt) {
      return { error: "Choose a time slot." };
    }

    const { context } = await loadStudentBookingContext(supabase, user.id);
    if (
      !context ||
      context.tutorUnresolved ||
      context.tutorId !== tutorId ||
      !context.settings ||
      !context.bookingEnabled
    ) {
      return { error: "You are not eligible to book with this tutor." };
    }

    const availableCredits = await countAvailableBookingCredits(supabase, user.id);
    if (availableCredits < 1) {
      return { error: "Purchase a 1-to-1 session before booking a time." };
    }

    const creditId = String(formData.get("credit_id") ?? "").trim();
    if (!creditId) {
      return { error: "No session credit selected." };
    }

    const admin = createServiceRoleClient();
    const { data: credit, error: creditError } = await admin
      .from("tutor_one_to_one_booking_credits")
      .select("id, status, course_id, tutor_id")
      .eq("id", creditId)
      .eq("student_id", user.id)
      .eq("status", "available")
      .maybeSingle();

    if (creditError || !credit) {
      return { error: "Your session credit is no longer available. Purchase a new session." };
    }

    if (credit.course_id && context.courseId && credit.course_id !== context.courseId) {
      return {
        error: "This credit is for a different course. Refresh the page and try again.",
      };
    }

    if (credit.tutor_id && credit.tutor_id !== tutorId) {
      return {
        error: "This credit is for a different tutor. Refresh the page and try again.",
      };
    }

    const slotStart = new Date(startsAt).getTime();
    const earliest = Date.now() + context.settings.bookingBufferHours * 60 * 60 * 1000;
    if (slotStart < earliest) {
      return {
        error: `Bookings must be at least ${context.settings.bookingBufferHours} hours in advance.`,
      };
    }

    const rangeStart = startsAt;
    const rangeEnd = endsAt;
    const busyBlocks = await loadTutorBusyBlocks(supabase, tutorId, rangeStart, rangeEnd);
    if (busyBlocks.length > 0) {
      return { error: "That time is no longer available. Please choose another slot." };
    }

    const availability = await loadTutorAvailability(supabase, tutorId);
    const validSlots = generateBookableSlots(context.settings, availability.windows, busyBlocks, {
      fromMs: slotStart - 24 * 60 * 60 * 1000,
      daysAhead: 2,
    });
    const isValid = validSlots.some((slot) => slot.startsAt === startsAt && slot.endsAt === endsAt);
    if (!isValid) {
      return { error: "That slot is outside your tutor's available hours." };
    }

    const { data, error } = await admin
      .from("tutor_one_to_one_bookings")
      .insert({
        tutor_id: tutorId,
        student_id: user.id,
        starts_at: startsAt,
        ends_at: endsAt,
        status: "confirmed",
        notes,
      })
      .select("id")
      .single();

    if (error) {
      if (isAvailabilitySchemaMissingError(error)) {
        return { error: "Booking is not set up yet. Run supabase/tutor-availability-and-bookings.sql." };
      }
      if (error.code === "23505") {
        return { error: "That time was just taken. Please choose another slot." };
      }
      return { error: error.message };
    }

    const bookingId = data.id as string;

    const { error: useCreditError } = await admin
      .from("tutor_one_to_one_booking_credits")
      .update({
        status: "used",
        booking_id: bookingId,
        used_at: new Date().toISOString(),
      })
      .eq("id", creditId)
      .eq("student_id", user.id)
      .eq("status", "available");

    if (useCreditError) {
      await admin
        .from("tutor_one_to_one_bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", bookingId);
      return { error: "Could not apply your session credit. Please try again." };
    }

    const studentEmail = user.email?.trim();
    if (!studentEmail) {
      await admin
        .from("tutor_one_to_one_booking_credits")
        .update({ status: "available", booking_id: null, used_at: null })
        .eq("id", creditId)
        .eq("student_id", user.id);
      await admin
        .from("tutor_one_to_one_bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", bookingId);
      return { error: "Add an email to your account before booking a calendar lesson." };
    }

    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("full_name, preferred_name")
      .eq("id", user.id)
      .maybeSingle();
    const studentName = studentProfile ? getDisplayName(studentProfile) : null;
    const lessonTitle = studentName
      ? `1-to-1 lesson with ${studentName}`
      : "1-to-1 Kidda lesson";

    const calendarResult = await createOneToOneCalendarSession(admin, {
      tutorId,
      studentId: user.id,
      studentEmail,
      startsAt,
      endsAt,
      courseId: (credit.course_id as string | null) ?? context.courseId,
      title: lessonTitle,
      notes,
      timeZone: context.settings.timezone,
    });

    if (!calendarResult.ok) {
      await admin
        .from("tutor_one_to_one_booking_credits")
        .update({ status: "available", booking_id: null, used_at: null })
        .eq("id", creditId)
        .eq("student_id", user.id);
      await admin
        .from("tutor_one_to_one_bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", bookingId);
      return { error: calendarResult.error };
    }

    const { error: linkSessionError } = await admin
      .from("tutor_one_to_one_bookings")
      .update({
        session_id: calendarResult.sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (linkSessionError) {
      console.error("booked lesson calendar link failed:", linkSessionError.message);
    }

    revalidatePath("/dashboard/schedule");
    return {
      success: calendarResult.meetLink
        ? "Lesson booked! Check Upcoming lessons for your join link and calendar invite."
        : "Lesson booked! You should receive a calendar invite shortly — check Upcoming lessons.",
      bookingId,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create booking." };
  }
}

export async function cancelPendingBooking(bookingId: string): Promise<BookingActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const admin = createServiceRoleClient();
    const { cancelConfirmedOneToOneBooking } = await import(
      "@/lib/tutoring/cancel-one-to-one-booking"
    );
    const result = await cancelConfirmedOneToOneBooking(admin, {
      bookingId,
      studentId: user.id,
    });

    if (!result.ok) return { error: result.error };

    // Best-effort calendar follow-up after DB cancel commits — never blocks the student.
    if (result.cancelledSessionId) {
      const sessionId = result.cancelledSessionId;
      after(async () => {
        try {
          const { cancelOneToOneSessionGoogleCalendarEvent } = await import(
            "@/lib/tutoring/cancel-one-to-one-calendar-event"
          );
          await cancelOneToOneSessionGoogleCalendarEvent(admin, sessionId);
        } catch (error) {
          console.error(
            "[one-to-one] calendar cancel follow-up crashed:",
            error instanceof Error ? error.message : error,
            "session=",
            sessionId
          );
        }
      });
    }

    revalidatePath("/dashboard/schedule");
    return {
      success:
        "Booking cancelled. Your 1-to-1 credit has been returned — pick a new time below when you're ready.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to cancel booking." };
  }
}
