import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { getStripe } from "@/lib/stripe/server";
import type Stripe from "stripe";
import { CANCEL_REASONS, type CancelReason } from "@/lib/stripe/cancel-reasons";

export { isCancelReason, type CancelReason } from "@/lib/stripe/cancel-reasons";

/**
 * Cancel-save offer: when a member goes to cancel, they can stay and get their next month free.
 * One offer per subscription. A 100%-off coupon that lasts for one invoice; during the 3-month
 * intro that is the first £25 month, afterwards it is the next monthly payment.
 * The coupon is created in Stripe the first time it's needed, so nothing has to be set up by hand.
 */
export const SAVE_COUPON_ID = "kidda_stay_month_free";

export type CancellableSubscription = {
  id: string;
  name: string;
  /** When access ends if they cancel now (end of the paid period or the 3-month intro). */
  endsAt: string | null;
  /** Amount of the next payment the free month would cover, e.g. "£25.00". */
  nextAmountLabel: string | null;
  offerAvailable: boolean;
};

const CANCELLABLE_STATUSES = new Set(["active", "trialing", "past_due"]);

async function customerIdsForUser(userId: string, email: string | null): Promise<string[]> {
  const ids = new Set<string>();
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("memberships")
    .select("stripe_customer_id")
    .eq("user_id", userId);
  for (const row of data ?? []) {
    const id = (row as { stripe_customer_id: string | null }).stripe_customer_id?.trim();
    if (id) ids.add(id);
  }
  if (email) {
    const customers = await getStripe().customers.list({ email, limit: 10 });
    for (const customer of customers.data) ids.add(customer.id);
  }
  return [...ids];
}

function hasDiscount(sub: Stripe.Subscription): boolean {
  return (sub.discounts ?? []).length > 0;
}

function offerAvailable(sub: Stripe.Subscription): boolean {
  return sub.metadata?.save_offer_used !== "true" && !hasDiscount(sub);
}

function subscriptionName(sub: Stripe.Subscription): string {
  if (sub.metadata?.product === "community_membership") return "Kidda Premium + Community";
  if (sub.metadata?.tier_name === "premium") return "Kidda Premium";
  return sub.items.data[0]?.price?.nickname ?? sub.description ?? "Kidda membership";
}

function endsAt(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const end = sub.status === "trialing" && sub.trial_end ? sub.trial_end : item?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

function amountLabel(sub: Stripe.Subscription): string | null {
  const price = sub.items.data[0]?.price;
  if (price?.unit_amount == null || !price.currency) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: price.currency.toUpperCase() }).format(
    price.unit_amount / 100
  );
}

async function listOpenSubscriptions(userId: string, email: string | null): Promise<Stripe.Subscription[]> {
  const stripe = getStripe();
  const subs: Stripe.Subscription[] = [];
  for (const customer of await customerIdsForUser(userId, email)) {
    const list = await stripe.subscriptions.list({ customer, status: "all", limit: 20 });
    for (const sub of list.data) {
      if (CANCELLABLE_STATUSES.has(sub.status) && !sub.cancel_at_period_end) subs.push(sub);
    }
  }
  return subs;
}

/** Memberships the signed-in user can cancel on the Billing page. */
export async function loadCancellableSubscriptions(
  userId: string,
  email: string | null
): Promise<CancellableSubscription[]> {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) return [];
  try {
    const subs = await listOpenSubscriptions(userId, email);
    return subs.map((sub) => ({
      id: sub.id,
      name: subscriptionName(sub),
      endsAt: endsAt(sub),
      nextAmountLabel: amountLabel(sub),
      offerAvailable: offerAvailable(sub),
    }));
  } catch (error) {
    console.error("[cancel-save] failed to load subscriptions:", error);
    return [];
  }
}

/** The subscription, only if it belongs to this user and is still open. */
export async function findOwnedOpenSubscription(
  userId: string,
  email: string | null,
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  const subs = await listOpenSubscriptions(userId, email);
  return subs.find((sub) => sub.id === subscriptionId) ?? null;
}

async function ensureSaveCoupon(stripe: Stripe): Promise<void> {
  try {
    await stripe.coupons.retrieve(SAVE_COUPON_ID);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "resource_missing") throw error;
    await stripe.coupons.create({
      id: SAVE_COUPON_ID,
      name: "Stay with Kidda: a month on us",
      percent_off: 100,
      duration: "once",
    });
  }
}

export async function acceptSaveOffer(sub: Stripe.Subscription, reason: CancelReason | null): Promise<void> {
  const stripe = getStripe();
  await ensureSaveCoupon(stripe);
  await stripe.subscriptions.update(sub.id, {
    discounts: [{ coupon: SAVE_COUPON_ID }],
    metadata: {
      save_offer_used: "true",
      save_offer_accepted_at: new Date().toISOString(),
      ...(reason ? { save_offer_reason: reason } : {}),
    },
  });
}

/** Cancels at the end of what they've paid for, so they keep access until then. */
export async function cancelAtPeriodEnd(sub: Stripe.Subscription, reason: CancelReason | null): Promise<void> {
  await getStripe().subscriptions.update(sub.id, {
    cancel_at_period_end: true,
    cancellation_details: reason
      ? { feedback: CANCEL_REASONS[reason].feedback, comment: CANCEL_REASONS[reason].label }
      : undefined,
    metadata: {
      cancel_requested_at: new Date().toISOString(),
      ...(reason ? { cancel_reason: reason } : {}),
      ...(offerAvailable(sub) ? {} : { save_offer_used: "true" }),
    },
  });
}
