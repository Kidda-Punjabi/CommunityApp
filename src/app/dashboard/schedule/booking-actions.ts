"use server";

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
import type { BookableSlot } from "@/lib/tutoring/availability/types";

export type BookingActionResult = { error?: string; success?: string; bookingId?: string };

export async function syncBookingPayment(sessionId: string): Promise<BookingActionResult> {
  try {
    const result = await syncBookingCreditFromCheckoutSession(sessionId);
    if (!result.granted) {
      return { error: "Payment not completed yet. Refresh in a moment if you just paid." };
    }
    revalidatePath("/dashboard/schedule");
    return { success: "Payment received — pick a time for your lesson below." };
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
    if (!context || context.tutorId !== tutorId) {
      return { slots: [], error: "You are not enrolled for 1-to-1 with this tutor." };
    }
    if (!context.bookingEnabled || !context.settings) {
      return { slots: [], error: "Your tutor has not opened booking yet." };
    }
    if (context.availableCredits < 1) {
      return { slots: [], error: "Purchase a 1-to-1 session before booking a time." };
    }

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
    if (!context || context.tutorId !== tutorId || !context.settings) {
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
      .select("id, status")
      .eq("id", creditId)
      .eq("student_id", user.id)
      .eq("status", "available")
      .maybeSingle();

    if (creditError || !credit) {
      return { error: "Your session credit is no longer available. Purchase a new session." };
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

    revalidatePath("/dashboard/schedule");
    return {
      success: "Lesson booked! Your tutor will see it on their calendar.",
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
    const { data: booking } = await admin
      .from("tutor_one_to_one_bookings")
      .select("id, status, starts_at")
      .eq("id", bookingId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (!booking) return { error: "Booking not found." };
    if (booking.status !== "confirmed") {
      return { error: "This booking cannot be cancelled here." };
    }

    const { error } = await admin
      .from("tutor_one_to_one_bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("student_id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/schedule");
    return { success: "Booking cancelled. Contact support if you need a credit refund." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to cancel booking." };
  }
}
