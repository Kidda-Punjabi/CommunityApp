import "server-only";

import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
} from "@/lib/membership/profile-tier";
import { setProfileMembershipTier } from "@/lib/membership/premium-access";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { getStripe } from "@/lib/stripe/server";
import { isPremiumPaymentLinkSession } from "@/lib/stripe/premium-payment-links";
import type Stripe from "stripe";

function premiumPriceIdSet(): Set<string> {
  const ids = [
    process.env.STRIPE_PREMIUM_QUARTERLY_PRICE_ID?.trim(),
    process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID?.trim(),
  ].filter((id): id is string => Boolean(id?.startsWith("price_")));
  return new Set(ids);
}

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function subscriptionIsEntitled(status: string): boolean {
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

function subscriptionHasPremiumPrice(subscription: Stripe.Subscription): boolean {
  const prices = premiumPriceIdSet();
  if (prices.size === 0) return false;
  return subscription.items.data.some((item) => prices.has(item.price.id));
}

async function upsertMembershipForUser(params: {
  userId: string;
  customerId: string | null;
  subscriptionId: string | null;
  status: SubscriptionStatus;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  // Prefer match by subscription id, then by user (one Premium row per member).
  // Live schema has UNIQUE on stripe_subscription_id but not on user_id.
  let existingId: string | null = null;

  if (params.subscriptionId) {
    const { data } = await admin
      .from("memberships")
      .select("id")
      .eq("stripe_subscription_id", params.subscriptionId)
      .maybeSingle();
    existingId = data?.id ?? null;
  }

  if (!existingId) {
    const { data } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", params.userId)
      .eq("tier_name", "premium")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingId = data?.id ?? null;
  }

  const row = {
    user_id: params.userId,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    status: params.status,
    tier_name: "premium",
    updated_at: now,
  };

  if (existingId) {
    const { error } = await admin.from("memberships").update(row).eq("id", existingId);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("memberships").insert({
    ...row,
    created_at: now,
  });
  if (error) throw error;
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<boolean> {
  const stripe = getStripe();
  const prices = premiumPriceIdSet();

  let isPremium = false;
  if (prices.size > 0) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price"],
    });
    isPremium = lineItems.data.some((item) => {
      const priceId = typeof item.price === "string" ? item.price : item.price?.id;
      return Boolean(priceId && prices.has(priceId));
    });
  }

  if (!isPremium) {
    // Fallback when price env vars are not set yet: match Payment Link URLs.
    isPremium = await isPremiumPaymentLinkSession(session);
  }

  if (!isPremium) return false;

  const userId = session.client_reference_id;
  if (!userId) {
    console.error(
      "[premium] checkout.session.completed missing client_reference_id",
      session.id
    );
    return true; // handled as error — do not fall through to course sync
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId = customerIdOf(session.customer);

  await upsertMembershipForUser({
    userId,
    customerId,
    subscriptionId,
    status: "active",
  });
  await setProfileMembershipTier(userId, "premium");

  if (subscriptionId) {
    try {
      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          app_user_id: userId,
          supabase_user_id: userId,
          tier_name: "premium",
          checkout_key: "premium",
        },
      });
    } catch (error) {
      console.error("[premium] failed to stamp subscription metadata:", error);
    }
  }

  return true;
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data: membership } = await admin
    .from("memberships")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const isPremium =
    subscriptionHasPremiumPrice(subscription) ||
    Boolean(membership) ||
    subscription.metadata?.tier_name === "premium" ||
    subscription.metadata?.checkout_key?.startsWith("premium");

  if (!isPremium) return false;

  if (!membership?.user_id) {
    console.error("[premium] no membership row for subscription", subscription.id);
    return true;
  }

  const status = subscription.status as SubscriptionStatus;
  const stillEntitled = subscriptionIsEntitled(status);

  await admin
    .from("memberships")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  await setProfileMembershipTier(
    membership.user_id,
    stillEntitled ? "premium" : "free"
  );

  return true;
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data: membership } = await admin
    .from("memberships")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const isPremium =
    subscriptionHasPremiumPrice(subscription) ||
    Boolean(membership) ||
    subscription.metadata?.tier_name === "premium" ||
    subscription.metadata?.checkout_key?.startsWith("premium");

  if (!isPremium) return false;

  if (!membership?.user_id) {
    console.error(
      "[premium] no membership row for cancelled subscription",
      subscription.id
    );
    return true;
  }

  await admin
    .from("memberships")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  await setProfileMembershipTier(membership.user_id, "free");
  return true;
}

/**
 * Premium subscription webhook branches.
 * Returns true when this event was a Premium event (handled or error-handled),
 * so the main webhook can skip course/package sync for that event.
 *
 * Audit logging stays in the existing stripe_webhook_events helpers —
 * do not duplicate inserts here (live columns differ from the sketch).
 */
export async function handlePremiumWebhookEvent(
  event: Stripe.Event
): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "customer.subscription.updated":
    case "customer.subscription.created":
      return handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    default:
      return false;
  }
}

/** @deprecated Prefer handlePremiumWebhookEvent — kept for older imports. */
export async function syncPremiumFromStripeEvent(
  event: Stripe.Event
): Promise<{ updated: boolean; userId: string | null }> {
  const handled = await handlePremiumWebhookEvent(event);
  return { updated: handled, userId: null };
}
