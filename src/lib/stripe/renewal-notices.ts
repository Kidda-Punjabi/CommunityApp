import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { insertRoutedNotifications } from "@/lib/notifications/insert-notifications";
import {
  renewalMessage,
  renewalSubscriptionName,
  shouldSendRenewalNotice,
} from "@/lib/stripe/renewal-notice-plan";
import { getStripe } from "@/lib/stripe/server";
import { findUserIdByEmail } from "@/lib/stripe/sync-purchases";

const UNIQUE_VIOLATION = "23505";

type Counts = { checked: number; sent: number; alreadySent: number; unmatched: number; failed: number };

function periodEndOf(subscription: Stripe.Subscription): number | null {
  const item = subscription.items.data[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  const legacy = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return item?.current_period_end ?? legacy ?? null;
}

function isPremiumPrice(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return (
    priceId === process.env.STRIPE_PREMIUM_QUARTERLY_PRICE_ID?.trim() ||
    priceId === process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID?.trim()
  );
}

async function resolveUserId(
  admin: SupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMetadata =
    subscription.metadata?.app_user_id?.trim() || subscription.metadata?.supabase_user_id?.trim();
  if (fromMetadata) return fromMetadata;

  const { data: membership } = await admin
    .from("memberships")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (membership?.user_id) return membership.user_id as string;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer || !customer.email) return null;
  return findUserIdByEmail(customer.email);
}

async function subscriptionName(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  productNames: Map<string, string | null>
): Promise<string> {
  const price = subscription.items.data[0]?.price;
  if (isPremiumPrice(price?.id)) return renewalSubscriptionName(null, true);
  const productId = typeof price?.product === "string" ? price.product : price?.product?.id;
  if (!productId) return renewalSubscriptionName(null, false);
  if (!productNames.has(productId)) {
    const product = await stripe.products.retrieve(productId);
    productNames.set(productId, "deleted" in product ? null : product.name);
  }
  return renewalSubscriptionName(productNames.get(productId) ?? null, false);
}

async function notifyOne(
  admin: SupabaseClient,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  periodEnd: number,
  productNames: Map<string, string | null>,
  counts: Counts
): Promise<void> {
  const periodEndDate = new Date(periodEnd * 1000);
  const periodEndIso = periodEndDate.toISOString();

  const { data: existing } = await admin
    .from("subscription_renewal_notices")
    .select("stripe_subscription_id")
    .eq("stripe_subscription_id", subscription.id)
    .eq("period_end", periodEndIso)
    .maybeSingle();
  if (existing) {
    counts.alreadySent += 1;
    return;
  }

  const userId = await resolveUserId(admin, stripe, subscription);
  if (!userId) {
    counts.unmatched += 1;
    console.warn("[renewal notices] no app user for subscription", subscription.id);
    return;
  }

  const name = await subscriptionName(stripe, subscription, productNames);

  const { error: claimError } = await admin.from("subscription_renewal_notices").insert({
    stripe_subscription_id: subscription.id,
    period_end: periodEndIso,
    user_id: userId,
  });
  if (claimError) {
    if (claimError.code === UNIQUE_VIOLATION) {
      counts.alreadySent += 1;
      return;
    }
    throw claimError;
  }

  try {
    await insertRoutedNotifications(admin, {
      type: "subscription_renewal",
      userId,
      payload: {
        message: renewalMessage(name, periodEndDate),
        subscription_name: name,
        renews_at: periodEndIso,
      },
    });
    counts.sent += 1;
  } catch (error) {
    // Release the claim so tomorrow's run tries again.
    await admin
      .from("subscription_renewal_notices")
      .delete()
      .eq("stripe_subscription_id", subscription.id)
      .eq("period_end", periodEndIso);
    throw error;
  }
}

/** Puts one notice in the app, and on the phone via the push sweep, for each subscription renewing within 7 days. */
export async function sendRenewalNotices(admin: SupabaseClient, now = new Date()): Promise<Counts> {
  const stripe = getStripe();
  const counts: Counts = { checked: 0, sent: 0, alreadySent: 0, unmatched: 0, failed: 0 };
  const productNames = new Map<string, string | null>();

  for (const status of ["active", "trialing"] as const) {
    for await (const subscription of stripe.subscriptions.list({ status, limit: 100 })) {
      counts.checked += 1;
      const periodEnd = periodEndOf(subscription);
      const due = shouldSendRenewalNotice(
        {
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          cancelAt: subscription.cancel_at,
          paused: Boolean(subscription.pause_collection),
          periodEnd,
        },
        now
      );
      if (!due || !periodEnd) continue;

      try {
        await notifyOne(admin, stripe, subscription, periodEnd, productNames, counts);
      } catch (error) {
        counts.failed += 1;
        console.error("[renewal notices]", subscription.id, error);
      }
    }
  }
  return counts;
}
