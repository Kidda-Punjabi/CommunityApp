import "server-only";

import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  type ProfileMembershipTier,
  type SubscriptionStatus,
} from "@/lib/membership/profile-tier";
import { setProfileMembershipTier } from "@/lib/membership/premium-access";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { findUserIdByEmail } from "@/lib/stripe/sync-purchases";
import { getStripe } from "@/lib/stripe/server";
import {
  isPremiumCheckoutKey,
  premiumPriceIds,
} from "@/lib/products/premium-checkout";
import type Stripe from "stripe";

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function subscriptionIsEntitled(status: string): boolean {
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

function priceIsPremium(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  const ids = premiumPriceIds();
  return Boolean(
    (ids.quarterly && priceId === ids.quarterly) ||
      (ids.annual && priceId === ids.annual)
  );
}

async function resolveUserIdFromSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta =
    subscription.metadata?.app_user_id ??
    subscription.metadata?.supabase_user_id ??
    null;
  if (fromMeta) return fromMeta;

  const customerId = customerIdOf(subscription.customer);
  if (!customerId) return null;

  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer) return null;

  if (customer.metadata?.app_user_id) return customer.metadata.app_user_id;
  if (customer.email) return findUserIdByEmail(customer.email);
  return null;
}

async function upsertMembershipRow(params: {
  userId: string;
  customerId: string | null;
  subscriptionId: string;
  status: SubscriptionStatus;
  tierName: string;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("memberships")
    .select("id")
    .eq("stripe_subscription_id", params.subscriptionId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("memberships")
      .update({
        user_id: params.userId,
        stripe_customer_id: params.customerId,
        status: params.status,
        tier_name: params.tierName,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("memberships").insert({
    user_id: params.userId,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    status: params.status,
    tier_name: params.tierName,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
}

async function syncProfileTierFromSubscriptions(userId: string) {
  const admin = createServiceRoleClient();
  const { data: active } = await admin
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .in("status", [...ACTIVE_SUBSCRIPTION_STATUSES])
    .limit(1)
    .maybeSingle();

  const tier: ProfileMembershipTier = active ? "premium" : "free";
  await setProfileMembershipTier(userId, tier);
}

export async function syncPremiumFromSubscription(
  subscription: Stripe.Subscription
): Promise<{ updated: boolean; userId: string | null }> {
  const priceIds = subscription.items.data.map((item) => item.price?.id).filter(Boolean);
  const looksPremium =
    subscription.metadata?.checkout_key?.startsWith("premium") ||
    priceIds.some((id) => priceIsPremium(id));

  if (!looksPremium) {
    return { updated: false, userId: null };
  }

  const userId = await resolveUserIdFromSubscription(subscription);
  if (!userId) return { updated: false, userId: null };

  const status = subscription.status as SubscriptionStatus;
  await upsertMembershipRow({
    userId,
    customerId: customerIdOf(subscription.customer),
    subscriptionId: subscription.id,
    status,
    tierName: "premium",
  });

  if (subscriptionIsEntitled(status)) {
    await setProfileMembershipTier(userId, "premium");
  } else {
    await syncProfileTierFromSubscriptions(userId);
  }

  return { updated: true, userId };
}

export async function syncPremiumFromCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<{ updated: boolean; userId: string | null }> {
  const checkoutKey = session.metadata?.checkout_key ?? "";
  if (!isPremiumCheckoutKey(checkoutKey)) {
    return { updated: false, userId: null };
  }

  const userId =
    session.metadata?.app_user_id ??
    session.metadata?.supabase_user_id ??
    session.client_reference_id ??
    (session.customer_details?.email || session.customer_email
      ? await findUserIdByEmail(
          (session.customer_details?.email ?? session.customer_email)!
        )
      : null);

  if (!userId) return { updated: false, userId: null };

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (!subscriptionId) {
    // Session completed but subscription not expanded — still mark premium if paid.
    if (session.payment_status === "paid" || session.status === "complete") {
      await setProfileMembershipTier(userId, "premium");
      return { updated: true, userId };
    }
    return { updated: false, userId };
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncPremiumFromSubscription(subscription);
}

export async function syncPremiumFromStripeEvent(
  event: Stripe.Event
): Promise<{ updated: boolean; userId: string | null }> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return syncPremiumFromCheckoutSession(session);
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    return syncPremiumFromSubscription(subscription);
  }

  return { updated: false, userId: null };
}
