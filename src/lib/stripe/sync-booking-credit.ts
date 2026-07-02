import "server-only";

import { ONE_TO_ONE_SESSION_CHECKOUT_KEY } from "@/lib/products/checkout";
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

  const configuredPriceId = process.env.STRIPE_CHECKOUT_PRICE_ONE_TO_ONE_SESSION?.trim();
  if (configuredPriceId && session.metadata?.checkout_key === ONE_TO_ONE_SESSION_CHECKOUT_KEY) {
    return true;
  }

  if (session.payment_link && session.client_reference_id) {
    const paymentLinkUrl = process.env.STRIPE_PAYMENT_LINK_ONE_TO_ONE_SESSION?.trim();
    if (paymentLinkUrl) return true;
  }

  const plinkId = process.env.STRIPE_PAYMENT_LINK_ONE_TO_ONE_SESSION_PLINK_ID?.trim();
  if (plinkId && session.payment_link === plinkId) {
    return true;
  }

  return false;
}

export async function syncBookingCreditFromCheckoutSession(
  sessionId: string
): Promise<{ granted: boolean; creditId?: string }> {
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
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (existing?.id) {
    return { granted: true, creditId: existing.id as string };
  }

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
      return { granted: true };
    }
    if (error.message?.includes("tutor_one_to_one_booking_credits")) {
      throw new Error("Booking credits table is not set up. Run the latest SQL migration.");
    }
    throw error;
  }

  return { granted: true, creditId: data.id as string };
}

export async function syncBookingCreditFromStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type !== "checkout.session.completed") return;
  const session = event.data.object as Stripe.Checkout.Session;
  await syncBookingCreditFromCheckoutSession(session.id);
}
