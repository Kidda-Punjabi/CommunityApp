import "server-only";

import {
  getCheckoutConfig,
  ONE_TO_ONE_SESSION_CHECKOUT_KEY,
  resolveCheckoutPriceId,
  resolvePaymentLinkForCheckout,
} from "@/lib/products/checkout";
import { getAppUrl, getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { isGroupPackageCheckoutKey } from "@/lib/group-purchase/checkout-keys";
import { getCohortCheckoutRemainingSpots } from "@/lib/group-purchase/cohort-capacity";
import { isCohortNotionSyncFresh } from "@/lib/group-purchase/cohort-picker-display";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

type CreateCheckoutSessionOptions = {
  checkoutKey: string;
  embedded?: boolean;
  cohortId?: string;
  cohortSeatHoldId?: string;
  oneToOneBookingId?: string;
};

async function resolveStripeCustomerId(userId: string, email: string): Promise<string> {
  const stripe = getStripe();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data[0]) {
      customerId = existing.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { app_user_id: userId },
      });
      customerId = customer.id;
    }

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  return customerId;
}

export async function createCheckoutSession({
  checkoutKey,
  embedded = false,
  cohortId,
  cohortSeatHoldId,
  oneToOneBookingId,
}: CreateCheckoutSessionOptions) {
  const config = getCheckoutConfig(checkoutKey);
  if (!config) {
    throw new Error("Unknown product.");
  }

  const priceId = resolveCheckoutPriceId(checkoutKey);
  const paymentLink = resolvePaymentLinkForCheckout(checkoutKey);

  if (!priceId && !paymentLink) {
    throw new Error("Checkout is not configured for this product.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const needsGroupCohort = await isGroupPackageCheckoutKey(supabase, checkoutKey);
  const needsOneToOneSlot = checkoutKey === ONE_TO_ONE_SESSION_CHECKOUT_KEY;

  if (needsOneToOneSlot) {
    if (!user) {
      throw new Error("Sign in to choose a lesson time and purchase a 1-to-1 session.");
    }
    if (!oneToOneBookingId?.trim()) {
      throw new Error("Choose a lesson time before checkout.");
    }

    const admin = createServiceRoleClient();
    const { data: pending, error: pendingError } = await admin
      .from("tutor_one_to_one_bookings")
      .select("id, student_id, status, created_at")
      .eq("id", oneToOneBookingId.trim())
      .maybeSingle();

    if (pendingError) throw new Error(pendingError.message);
    if (!pending || pending.student_id !== user.id || pending.status !== "pending_payment") {
      throw new Error("Your lesson time reservation expired or is invalid. Choose a time again.");
    }

    const holdAgeMs = Date.now() - new Date(pending.created_at as string).getTime();
    if (holdAgeMs > 20 * 60 * 1000) {
      await admin
        .from("tutor_one_to_one_bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", pending.id);
      throw new Error("Your lesson time reservation expired. Choose a time again.");
    }
  }

  if (needsGroupCohort) {
    if (!user) {
      throw new Error("Sign in to purchase a group course and choose a cohort.");
    }
    if (!priceId) {
      throw new Error(
        "Group checkout requires an configured Stripe Price (not a payment link). Add STRIPE_CHECKOUT_PRICE_BEGINNERS_GROUP."
      );
    }
    if (!cohortId?.trim() || !cohortSeatHoldId?.trim()) {
      throw new Error("Choose an open cohort before checkout.");
    }

    const { data: hold, error: holdError } = await supabase
      .from("cohort_seat_holds")
      .select("id, cohort_id, user_id, expires_at")
      .eq("id", cohortSeatHoldId)
      .maybeSingle();

    if (holdError) throw new Error(holdError.message);
    if (!hold || hold.user_id !== user.id || hold.cohort_id !== cohortId) {
      throw new Error("Cohort seat reservation expired or invalid. Choose a cohort again.");
    }

    if (new Date(hold.expires_at).getTime() <= Date.now()) {
      throw new Error("Your cohort seat reservation expired. Choose a cohort again.");
    }

    const admin = createServiceRoleClient();
    const { data: cohort, error: cohortError } = await admin
      .from("cohorts")
      .select("id, capacity, status, notion_synced_at")
      .eq("id", cohortId)
      .maybeSingle();

    if (cohortError) throw new Error(cohortError.message);
    if (!cohort || cohort.status !== "recruiting") {
      throw new Error("This cohort is no longer open for enrollment.");
    }

    if (!isCohortNotionSyncFresh(cohort.notion_synced_at)) {
      throw new Error("Cohort availability is still updating. Choose a cohort again.");
    }

    const remaining = await getCohortCheckoutRemainingSpots(admin, cohortId, cohort.capacity ?? 7, {
      honorHoldId: cohortSeatHoldId,
    });
    if (remaining <= 0) {
      throw new Error("This cohort just filled up. Pick another cohort.");
    }
  }

  if (!priceId && paymentLink) {
    if (needsOneToOneSlot && oneToOneBookingId && user) {
      // Payment links can't carry booking metadata — the pending hold on the user is enough.
      await createServiceRoleClient()
        .from("tutor_one_to_one_bookings")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", oneToOneBookingId.trim())
        .eq("student_id", user.id)
        .eq("status", "pending_payment");
    }
    return {
      type: "payment_link" as const,
      url: appendPaymentLinkParams(paymentLink, {
        email: user?.email,
        clientReferenceId: user?.id,
      }),
    };
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const successPath =
    checkoutKey === ONE_TO_ONE_SESSION_CHECKOUT_KEY
      ? `${appUrl}/dashboard/schedule?session_id={CHECKOUT_SESSION_ID}`
      : `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelPath =
    checkoutKey === ONE_TO_ONE_SESSION_CHECKOUT_KEY
      ? `${appUrl}/dashboard/schedule`
      : `${appUrl}/courses/${config.productSlug}`;
  const customerId = user?.email ? await resolveStripeCustomerId(user.id, user.email) : undefined;

  const baseParams = {
    mode: config.mode,
    line_items: [{ price: priceId!, quantity: 1 }],
    allow_promotion_codes: true as const,
    metadata: {
      checkout_key: checkoutKey,
      ...(user?.id ? { app_user_id: user.id } : {}),
      ...(needsGroupCohort && cohortId && cohortSeatHoldId
        ? { cohort_id: cohortId, cohort_seat_hold_id: cohortSeatHoldId }
        : {}),
      ...(needsOneToOneSlot && oneToOneBookingId
        ? { one_to_one_booking_id: oneToOneBookingId.trim() }
        : {}),
    },
    ...(customerId ? { customer: customerId } : {}),
  };

  const session = embedded
    ? await stripe.checkout.sessions.create({
        ...baseParams,
        ui_mode: "embedded_page",
        return_url: successPath,
      })
    : await stripe.checkout.sessions.create({
        ...baseParams,
        success_url: successPath,
        cancel_url: cancelPath,
      });

  if (needsGroupCohort && cohortSeatHoldId) {
    await supabase
      .from("cohort_seat_holds")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", cohortSeatHoldId)
      .eq("user_id", user!.id);
  }

  if (needsOneToOneSlot && oneToOneBookingId && user) {
    await createServiceRoleClient()
      .from("tutor_one_to_one_bookings")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", oneToOneBookingId.trim())
      .eq("student_id", user.id)
      .eq("status", "pending_payment");
  }

  if (embedded) {
    if (!session.client_secret) {
      throw new Error("Could not create embedded checkout session.");
    }
    return { type: "embedded" as const, clientSecret: session.client_secret };
  }

  if (!session.url) {
    throw new Error("Could not create checkout session.");
  }

  return { type: "hosted" as const, url: session.url };
}

export function appendPaymentLinkEmail(url: string, email: string | null | undefined): string {
  return appendPaymentLinkParams(url, { email });
}

export function appendPaymentLinkParams(
  url: string,
  params: { email?: string | null; clientReferenceId?: string | null }
): string {
  const parsed = new URL(url);
  if (params.email?.trim()) {
    parsed.searchParams.set("prefilled_email", params.email.trim());
  }
  if (params.clientReferenceId?.trim()) {
    parsed.searchParams.set("client_reference_id", params.clientReferenceId.trim());
  }
  return parsed.toString();
}
