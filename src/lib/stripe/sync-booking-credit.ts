import "server-only";

import { ONE_TO_ONE_SESSION_CHECKOUT_KEY } from "@/lib/products/checkout";
import { confirmPendingOneToOneBookingAfterPayment } from "@/lib/tutoring/confirm-pending-one-to-one-booking";
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

function isOneToOneSessionCheckout(session: Stripe.Checkout.Session): boolean {
  if (session.metadata?.checkout_key === ONE_TO_ONE_SESSION_CHECKOUT_KEY) {
    return true;
  }

  const plinkId = process.env.STRIPE_PAYMENT_LINK_ONE_TO_ONE_SESSION_PLINK_ID?.trim();
  if (plinkId && session.payment_link === plinkId) {
    return true;
  }

  return false;
}

export async function syncBookingCreditFromCheckoutSession(
  sessionId: string
): Promise<{
  granted: boolean;
  creditId?: string;
  bookingConfirmed?: boolean;
  meetLink?: string | null;
}> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { granted: false };
  }

  if (!isOneToOneSessionCheckout(session)) {
    return { granted: false };
  }

  const userId = await resolveUserIdFromSession(session);
  if (!userId) {
    throw new Error("Could not match this payment to your Kidda account. Use the same email at checkout.");
  }

  const admin = createServiceRoleClient();
  const { data: existing } = await admin
    .from("tutor_one_to_one_booking_credits")
    .select("id, booking_id, status")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  let creditId = existing?.id as string | undefined;

  if (!creditId) {
    const { data, error } = await admin
      .from("tutor_one_to_one_booking_credits")
      .insert({
        student_id: userId,
        stripe_checkout_session_id: session.id,
        status: "available",
        purchased_at: new Date(session.created * 1000).toISOString(),
      })
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
      } else {
        throw error;
      }
    } else {
      creditId = data.id as string;
    }
  }

  if (!creditId) {
    return { granted: true };
  }

  const bookingIdFromMeta = session.metadata?.one_to_one_booking_id?.trim() || null;
  let bookingId = bookingIdFromMeta;

  if (!bookingId) {
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

  if (!bookingId) {
    return { granted: true, creditId };
  }

  // Already confirmed on a prior success-page load.
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
      session.id
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

export async function syncBookingCreditFromStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type !== "checkout.session.completed") return;
  const session = event.data.object as Stripe.Checkout.Session;
  await syncBookingCreditFromCheckoutSession(session.id);
}
