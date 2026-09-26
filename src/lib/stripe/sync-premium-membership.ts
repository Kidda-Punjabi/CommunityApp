import "server-only";

import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
} from "@/lib/membership/profile-tier";
import { setProfileMembershipTier } from "@/lib/membership/premium-access";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { getStripe } from "@/lib/stripe/server";
import { isPremiumPaymentLinkSession } from "@/lib/stripe/premium-payment-links";
import { findUserIdByEmail } from "@/lib/stripe/sync-purchases";
import { markUnmatchedEventsProcessedForSubscription } from "@/lib/stripe/webhook-event-log";
import {
  awaitingCheckoutMessage,
  duplicateSubscriptionMessage,
  planPremiumMembershipWrite,
  unmatchedCheckoutMessage,
  type PremiumMembershipSnapshot,
} from "@/lib/stripe/premium-membership-plan";
import type Stripe from "stripe";

const STORED_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "canceled",
  "past_due",
  "incomplete",
  "trialing",
  "unpaid",
]);

export type PremiumWebhookResult =
  | { handled: false }
  | {
      handled: true;
      status: "processed" | "unmatched" | "duplicate_subscription" | "ignored";
      errorMessage?: string | null;
    };

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

function priceIdOf(price: string | Stripe.Price | null | undefined): string | null {
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

function subscriptionIsEntitled(status: string): boolean {
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

function toStoredStatus(status: string): SubscriptionStatus {
  if (status === "incomplete_expired" || status === "paused") return "canceled";
  if (STORED_STATUSES.has(status as SubscriptionStatus)) return status as SubscriptionStatus;
  return "incomplete";
}

function subscriptionHasPremiumPrice(subscription: Stripe.Subscription): boolean {
  const prices = premiumPriceIdSet();
  if (prices.size === 0) return false;
  return subscription.items.data.some((item) => prices.has(priceIdOf(item.price) ?? ""));
}

function appUserIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | null {
  const value = metadata?.app_user_id ?? metadata?.supabase_user_id ?? null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type MembershipRow = {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  status: string;
};

function snapshot(row: MembershipRow): PremiumMembershipSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status,
  };
}

async function loadPremiumRows(userId: string): Promise<MembershipRow[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("memberships")
    .select("id, user_id, stripe_subscription_id, status, updated_at")
    .eq("user_id", userId)
    .eq("tier_name", "premium")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MembershipRow[];
}

async function loadSubscriptionRow(subscriptionId: string): Promise<MembershipRow | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("memberships")
    .select("id, user_id, stripe_subscription_id, status")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  return (data as MembershipRow | null) ?? null;
}

async function resolveUserId(params: {
  clientReferenceId?: string | null;
  appUserId?: string | null;
  customerId?: string | null;
  email?: string | null;
}): Promise<string | null> {
  const clientReferenceId = params.clientReferenceId?.trim();
  if (clientReferenceId) return clientReferenceId;

  const appUserId = params.appUserId?.trim();
  if (appUserId) return appUserId;

  if (params.customerId) {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("memberships")
      .select("user_id")
      .eq("stripe_customer_id", params.customerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data?.user_id) return data.user_id as string;
  }

  const email = params.email?.trim();
  if (!email) return null;
  return findUserIdByEmail(email);
}

export type PremiumSaveMode = "webhook" | "claim";

export type PremiumSaveResult =
  | { outcome: "saved" }
  | { outcome: "already" }
  | { outcome: "duplicate"; errorMessage: string };

/**
 * Insert or replace the user's premium row.
 * Claim mode does not update a row that already has this subscription id.
 */
export async function savePremiumMembership(params: {
  userId: string;
  customerId: string | null;
  subscriptionId: string;
  status: SubscriptionStatus;
  mode: PremiumSaveMode;
}): Promise<PremiumSaveResult> {
  const admin = createServiceRoleClient();
  const [subscriptionRow, userRows] = await Promise.all([
    loadSubscriptionRow(params.subscriptionId),
    loadPremiumRows(params.userId),
  ]);
  const plan = planPremiumMembershipWrite({
    userId: params.userId,
    subscriptionId: params.subscriptionId,
    subscriptionRow: subscriptionRow ? snapshot(subscriptionRow) : null,
    userPremiumRows: userRows.map(snapshot),
  });

  if (plan.action === "duplicate") {
    return {
      outcome: "duplicate",
      errorMessage: duplicateSubscriptionMessage(
        plan.existingSubscriptionId,
        plan.incomingSubscriptionId
      ),
    };
  }

  const now = new Date().toISOString();
  const row = {
    user_id: params.userId,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    status: params.status,
    tier_name: "premium" as const,
    updated_at: now,
  };

  if (plan.action === "update") {
    const sameSubscription =
      subscriptionRow?.id === plan.membershipId &&
      subscriptionRow.stripe_subscription_id === params.subscriptionId;
    if (params.mode === "claim" && sameSubscription) {
      return { outcome: "already" };
    }
    const { error } = await admin.from("memberships").update(row).eq("id", plan.membershipId);
    if (error?.code === "23505") {
      return {
        outcome: "duplicate",
        errorMessage: duplicateSubscriptionMessage(
          subscriptionRow?.stripe_subscription_id ?? "(none)",
          params.subscriptionId
        ),
      };
    }
    if (error) throw error;
    return { outcome: "saved" };
  }

  const { error } = await admin.from("memberships").insert({
    ...row,
    created_at: now,
  });
  if (error?.code === "23505") {
    const owner = await loadSubscriptionRow(params.subscriptionId);
    if (owner && owner.user_id !== params.userId) {
      return {
        outcome: "duplicate",
        errorMessage: duplicateSubscriptionMessage(
          owner.stripe_subscription_id ?? params.subscriptionId,
          params.subscriptionId
        ),
      };
    }
    return { outcome: "already" };
  }
  if (error) throw error;
  return { outcome: "saved" };
}

async function stampSubscriptionMetadata(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  userId: string
) {
  try {
    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        ...subscription.metadata,
        app_user_id: userId,
        supabase_user_id: userId,
        tier_name: "premium",
        checkout_key: subscription.metadata?.checkout_key || "premium",
      },
    });
  } catch (error) {
    console.error("[premium] failed to stamp subscription metadata:", error);
  }
}

async function finishSavedSubscription(params: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
  userId: string;
  status: SubscriptionStatus;
}) {
  await setProfileMembershipTier(
    params.userId,
    subscriptionIsEntitled(params.status) ? "premium" : "free"
  );
  await stampSubscriptionMetadata(params.stripe, params.subscription, params.userId);
  await markUnmatchedEventsProcessedForSubscription(params.subscription.id);
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<PremiumWebhookResult> {
  const stripe = getStripe();
  const prices = premiumPriceIdSet();

  let isPremium = false;
  if (prices.size > 0) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price"],
    });
    isPremium = lineItems.data.some((item) => {
      const priceId = priceIdOf(item.price);
      return Boolean(priceId && prices.has(priceId));
    });
  }

  if (!isPremium) {
    isPremium = await isPremiumPaymentLinkSession(session);
  }

  if (!isPremium) return { handled: false };

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId = customerIdOf(session.customer);
  const email = session.customer_details?.email ?? session.customer_email ?? null;

  const subscription = subscriptionId
    ? await stripe.subscriptions.retrieve(subscriptionId)
    : null;

  const userId = await resolveUserId({
    clientReferenceId: session.client_reference_id,
    appUserId: appUserIdFromMetadata(subscription?.metadata) ?? appUserIdFromMetadata(session.metadata),
    customerId,
    email,
  });

  if (!userId || !subscription) {
    return {
      handled: true,
      status: "unmatched",
      errorMessage: unmatchedCheckoutMessage(email, subscriptionId),
    };
  }

  const status = toStoredStatus(subscription.status);
  const saved = await savePremiumMembership({
    userId,
    customerId,
    subscriptionId: subscription.id,
    status,
    mode: "webhook",
  });

  if (saved.outcome === "duplicate") {
    return {
      handled: true,
      status: "duplicate_subscription",
      errorMessage: saved.errorMessage,
    };
  }

  await finishSavedSubscription({ stripe, subscription, userId, status });
  return { handled: true, status: "processed" };
}

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  kind: "upsert" | "deleted"
): Promise<PremiumWebhookResult> {
  const admin = createServiceRoleClient();
  const existing = await loadSubscriptionRow(subscription.id);

  const isPremium =
    subscriptionHasPremiumPrice(subscription) ||
    Boolean(existing) ||
    subscription.metadata?.tier_name === "premium" ||
    subscription.metadata?.checkout_key?.startsWith("premium");

  if (!isPremium) return { handled: false };

  if (kind === "deleted") {
    if (!existing?.user_id) {
      return {
        handled: true,
        status: "unmatched",
        errorMessage: `no membership row for cancelled subscription ${subscription.id}`,
      };
    }
    const { error } = await admin
      .from("memberships")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscription.id);
    if (error) throw error;
    await setProfileMembershipTier(existing.user_id, "free");
    return { handled: true, status: "processed" };
  }

  if (existing?.user_id) {
    const status = toStoredStatus(subscription.status);
    const { error } = await admin
      .from("memberships")
      .update({
        status,
        stripe_customer_id: customerIdOf(subscription.customer),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscription.id);
    if (error) throw error;
    await setProfileMembershipTier(
      existing.user_id,
      subscriptionIsEntitled(status) ? "premium" : "free"
    );
    return { handled: true, status: "processed" };
  }

  const userId = await resolveUserId({
    appUserId: appUserIdFromMetadata(subscription.metadata),
    customerId: customerIdOf(subscription.customer),
  });

  if (!userId) {
    return {
      handled: true,
      status: "unmatched",
      errorMessage: awaitingCheckoutMessage(subscription.id),
    };
  }

  const status = toStoredStatus(subscription.status);
  const saved = await savePremiumMembership({
    userId,
    customerId: customerIdOf(subscription.customer),
    subscriptionId: subscription.id,
    status,
    mode: "webhook",
  });

  if (saved.outcome === "duplicate") {
    return {
      handled: true,
      status: "duplicate_subscription",
      errorMessage: saved.errorMessage,
    };
  }

  await finishSavedSubscription({
    stripe: getStripe(),
    subscription,
    userId,
    status,
  });
  return { handled: true, status: "processed" };
}

/**
 * Premium subscription webhook branches.
 * Returns handled: false when the event is not Premium, so course sync can run.
 */
export async function handlePremiumWebhookEvent(
  event: Stripe.Event
): Promise<PremiumWebhookResult> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case "customer.subscription.updated":
    case "customer.subscription.created":
      return handleSubscriptionChange(event.data.object as Stripe.Subscription, "upsert");
    case "customer.subscription.deleted":
      return handleSubscriptionChange(event.data.object as Stripe.Subscription, "deleted");
    default:
      return { handled: false };
  }
}

/** @deprecated Prefer handlePremiumWebhookEvent — kept for older imports. */
export async function syncPremiumFromStripeEvent(
  event: Stripe.Event
): Promise<{ updated: boolean; userId: string | null }> {
  const result = await handlePremiumWebhookEvent(event);
  return {
    updated: result.handled && result.status === "processed",
    userId: null,
  };
}
