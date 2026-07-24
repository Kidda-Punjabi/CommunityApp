import "server-only";

import { confirmPendingOneToOneBookingAfterPayment } from "@/lib/tutoring/confirm-pending-one-to-one-booking";
import {
  inferCourseScopeFromBookingTutor,
  resolveBookingCreditCourseScope,
} from "@/lib/tutoring/booking-credit-course";
import { isOneToOneSessionCheckout } from "@/lib/stripe/one-to-one-session-checkout";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { findUserIdByEmail } from "@/lib/stripe/sync-purchases";
import { getStripe } from "@/lib/stripe/server";
import type Stripe from "stripe";

async function resolveUserIdFromSession(session: Stripe.Checkout.Session): Promise<string | null> {
  const fromMetadata =
    session.metadata?.app_user_id ??
    session.metadata?.supabase_user_id ??
    session.client_reference_id ??
    null;
  if (fromMetadata) return fromMetadata;

  const email =
    session.customer_details?.email ?? session.customer_email ?? null;
  if (!email) return null;
  return findUserIdByEmail(email);
}

async function resolveScopeForCreditGrant(
  admin: ReturnType<typeof createServiceRoleClient>,
  params: {
    userId: string;
    session: Stripe.Checkout.Session;
    bookingId: string | null;
  }
): Promise<{ courseId: string | null; tutorId: string | null }> {
  const fromMeta = await resolveBookingCreditCourseScope(admin, {
    studentId: params.userId,
    courseIdFromMeta: params.session.metadata?.course_id ?? null,
    tutorIdFromMeta: params.session.metadata?.tutor_id ?? null,
    checkoutKey: params.session.metadata?.checkout_key ?? null,
  });
  if (fromMeta) {
    return { courseId: fromMeta.courseId, tutorId: fromMeta.tutorId };
  }

  if (params.bookingId) {
    const { data: booking } = await admin
      .from("tutor_one_to_one_bookings")
      .select("tutor_id")
      .eq("id", params.bookingId)
      .eq("student_id", params.userId)
      .maybeSingle();

    if (booking?.tutor_id) {
      const inferred = await inferCourseScopeFromBookingTutor(
        admin,
        params.userId,
        booking.tutor_id as string
      );
      if (inferred) {
        return { courseId: inferred.courseId, tutorId: inferred.tutorId };
      }
      return { courseId: null, tutorId: booking.tutor_id as string };
    }
  }

  return { courseId: null, tutorId: null };
}

export async function syncBookingCreditFromCheckoutSession(
  sessionId: string
): Promise<{
  granted: boolean;
  ignored?: boolean;
  creditId?: string;
  bookingConfirmed?: boolean;
  meetLink?: string | null;
}> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { granted: false };
  }

  if (!(await isOneToOneSessionCheckout(session))) {
    console.info(
      "[one-to-one] checkout session ignored (not a 1-to-1 session product):",
      session.id,
      "payment_link=",
      session.payment_link,
      "checkout_key=",
      session.metadata?.checkout_key
    );
    return { granted: false, ignored: true };
  }

  const userId = await resolveUserIdFromSession(session);
  if (!userId) {
    throw new Error(
      "Could not match this payment to your Kidda account. Use the same email at checkout."
    );
  }

  const admin = createServiceRoleClient();
  const { data: existing } = await admin
    .from("tutor_one_to_one_booking_credits")
    .select("id, booking_id, status, course_id, tutor_id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  let creditId = existing?.id as string | undefined;

  const bookingIdFromMeta = session.metadata?.one_to_one_booking_id?.trim() || null;
  let bookingId = bookingIdFromMeta;

  if (!bookingId) {
    // Prefer hold already linked to this checkout session.
    const { data: linkedHold } = await admin
      .from("tutor_one_to_one_bookings")
      .select("id, status")
      .eq("student_id", userId)
      .eq("stripe_checkout_session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkedHold?.id) {
      bookingId = linkedHold.id as string;
    } else {
      const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const { data: pendingHold } = await admin
        .from("tutor_one_to_one_bookings")
        .select("id")
        .eq("student_id", userId)
        .eq("status", "pending_payment")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      bookingId = (pendingHold?.id as string | undefined) ?? null;
    }
  }

  const scope = await resolveScopeForCreditGrant(admin, {
    userId,
    session,
    bookingId,
  });

  if (!creditId) {
    const insertPayload: Record<string, unknown> = {
      student_id: userId,
      stripe_checkout_session_id: session.id,
      status: "available",
      purchased_at: new Date(session.created * 1000).toISOString(),
    };
    if (scope.courseId) insertPayload.course_id = scope.courseId;
    if (scope.tutorId) insertPayload.tutor_id = scope.tutorId;

    const { data, error } = await admin
      .from("tutor_one_to_one_booking_credits")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: raced } = await admin
          .from("tutor_one_to_one_booking_credits")
          .select("id, booking_id, status")
          .eq("stripe_checkout_session_id", session.id)
          .maybeSingle();
        creditId = raced?.id as string | undefined;
      } else if (error.message?.includes("tutor_one_to_one_booking_credits")) {
        throw new Error("Booking credits table is not set up. Run the latest SQL migration.");
      } else if (
        error.message?.includes("course_id") ||
        error.message?.includes("tutor_id") ||
        error.code === "42703"
      ) {
        const { data: legacy, error: legacyError } = await admin
          .from("tutor_one_to_one_booking_credits")
          .insert({
            student_id: userId,
            stripe_checkout_session_id: session.id,
            status: "available",
            purchased_at: new Date(session.created * 1000).toISOString(),
          })
          .select("id")
          .single();
        if (legacyError) throw legacyError;
        creditId = legacy.id as string;
      } else {
        throw error;
      }
    } else {
      creditId = data.id as string;
    }

    console.info("[one-to-one] granted booking credit", {
      creditId,
      sessionId: session.id,
      userId,
      bookingId,
    });
  } else if ((!existing?.course_id || !existing?.tutor_id) && (scope.courseId || scope.tutorId)) {
    await admin
      .from("tutor_one_to_one_booking_credits")
      .update({
        ...(scope.courseId && !existing?.course_id ? { course_id: scope.courseId } : {}),
        ...(scope.tutorId && !existing?.tutor_id ? { tutor_id: scope.tutorId } : {}),
      })
      .eq("id", creditId);
  }

  if (!creditId) {
    return { granted: true };
  }

  if (!bookingId) {
    console.warn(
      "[one-to-one] credit granted without pending booking hold — student can book with credit",
      { creditId, sessionId: session.id, userId }
    );
    return { granted: true, creditId };
  }

  if (existing?.status === "used" && existing.booking_id === bookingId) {
    return { granted: true, creditId, bookingConfirmed: true };
  }

  const email =
    session.customer_details?.email ??
    session.customer_email ??
    null;
  if (!email?.trim()) {
    console.error("one-to-one checkout missing email for calendar booking", session.id);
    return { granted: true, creditId };
  }

  await admin
    .from("tutor_one_to_one_bookings")
    .update({
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("student_id", userId)
    .eq("status", "pending_payment");

  const { data: holdRow } = await admin
    .from("tutor_one_to_one_bookings")
    .select("id, status")
    .eq("id", bookingId)
    .eq("student_id", userId)
    .maybeSingle();

  if (!holdRow || holdRow.status !== "pending_payment") {
    console.warn(
      "[one-to-one] booking hold no longer pending — credit left available for self-serve booking",
      { creditId, sessionId: session.id, userId, bookingId, status: holdRow?.status }
    );
    return { granted: true, creditId, bookingConfirmed: false };
  }

  const confirmed = await confirmPendingOneToOneBookingAfterPayment(admin, {
    userId,
    creditId,
    bookingId,
    studentEmail: email.trim(),
  });

  if (!confirmed.ok) {
    console.error(
      "one-to-one pending booking confirm failed:",
      confirmed.error,
      "session=",
      session.id,
      "booking=",
      bookingId,
      "credit=",
      creditId
    );
    return { granted: true, creditId, bookingConfirmed: false };
  }

  return {
    granted: true,
    creditId,
    bookingConfirmed: true,
    meetLink: confirmed.meetLink,
  };
}

export async function syncBookingCreditFromStripeEvent(
  event: Stripe.Event
): Promise<"processed" | "ignored"> {
  if (event.type !== "checkout.session.completed") return "ignored";
  const session = event.data.object as Stripe.Checkout.Session;
  const result = await syncBookingCreditFromCheckoutSession(session.id);
  if (result.ignored) return "ignored";
  if (!result.granted) return "ignored";
  return "processed";
}
