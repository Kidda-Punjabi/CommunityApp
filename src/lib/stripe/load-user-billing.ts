import "server-only";

import { tiersFromLineItems } from "@/lib/stripe/sync-purchases";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import type Stripe from "stripe";
import {
  billingMembershipsForCard,
  billingSubscriptionName,
  customerIdsFromMemberships,
  type BillingMembershipRow,
} from "./billing-memberships";

export type UserPurchaseRow = {
  id: string;
  date: string;
  amountLabel: string | null;
  products: string[];
  tiers: string[];
  type: "payment" | "subscription";
  status: string;
};

export type UserSubscriptionRow = {
  id: string;
  status: string;
  productName: string;
  amountLabel: string | null;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

type BillingResult = {
  purchases: UserPurchaseRow[];
  subscriptions: UserSubscriptionRow[];
  hasStripeCustomer: boolean;
  error: string | null;
};

function formatAmount(amount: number | null, currency: string | null): string | null {
  if (amount == null || !currency) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function emptyBilling(error: string | null): BillingResult {
  return {
    purchases: [],
    subscriptions: [],
    hasStripeCustomer: false,
    error,
  };
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const legacyEnd = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  const end = item?.current_period_end ?? legacyEnd;
  return end ? new Date(end * 1000).toISOString() : null;
}

function rowsFromMemberships(rows: BillingMembershipRow[]): UserSubscriptionRow[] {
  return billingMembershipsForCard(rows).map((row) => ({
    id: row.id,
    status: row.status,
    productName: billingSubscriptionName(row.tier_name),
    amountLabel: null,
    interval: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  }));
}

function applyStripePeriod(
  subscriptions: UserSubscriptionRow[],
  memberships: BillingMembershipRow[],
  stripeSubs: Stripe.Subscription[]
) {
  const byStripeId = new Map(stripeSubs.map((sub) => [sub.id, sub]));
  const membershipById = new Map(memberships.map((row) => [row.id, row]));

  for (const subscription of subscriptions) {
    const membership = membershipById.get(subscription.id);
    const stripeSub = membership?.stripe_subscription_id
      ? byStripeId.get(membership.stripe_subscription_id)
      : undefined;
    if (!stripeSub) continue;

    const item = stripeSub.items.data[0];
    const price = item?.price;
    subscription.amountLabel = formatAmount(price?.unit_amount ?? null, price?.currency ?? null);
    subscription.interval = price?.recurring?.interval ?? null;
    subscription.currentPeriodEnd = subscriptionPeriodEnd(stripeSub);
    subscription.cancelAtPeriodEnd = stripeSub.cancel_at_period_end ?? false;
  }
}

export async function loadUserBilling(): Promise<BillingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return emptyBilling("Not signed in.");

  const { data: membershipRows, error: membershipError } = await supabase
    .from("memberships")
    .select("id, status, tier_name, stripe_customer_id, stripe_subscription_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (membershipError) {
    return emptyBilling(membershipError.message);
  }

  const memberships = (membershipRows ?? []) as BillingMembershipRow[];
  const subscriptions = rowsFromMemberships(memberships);
  const storedCustomerIds = customerIdsFromMemberships(memberships);

  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    return {
      purchases: [],
      subscriptions,
      hasStripeCustomer: storedCustomerIds.length > 0,
      error: "Billing is not configured.",
    };
  }

  try {
    const stripe = getStripe();
    const customerIds = new Set(storedCustomerIds);

    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 10 });
      for (const customer of customers.data) customerIds.add(customer.id);
    }

    const purchases: UserPurchaseRow[] = [];
    const stripeSubs: Stripe.Subscription[] = [];

    for (const customerId of customerIds) {
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 50,
      });

      for (const session of sessions.data) {
        if (session.payment_status !== "paid" && session.status !== "complete") continue;

        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 10,
          expand: ["data.price.product"],
        });

        purchases.push({
          id: session.id,
          date: new Date(session.created * 1000).toISOString(),
          amountLabel: formatAmount(session.amount_total, session.currency),
          products: lineItems.data.map((item) => item.description ?? "Purchase"),
          tiers: tiersFromLineItems(lineItems.data),
          type: session.mode === "subscription" ? "subscription" : "payment",
          status: session.payment_status ?? session.status ?? "unknown",
        });
      }

      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 20,
        expand: ["data.items.data.price"],
      });
      stripeSubs.push(...subs.data);
    }

    applyStripePeriod(subscriptions, memberships, stripeSubs);
    purchases.sort((a, b) => b.date.localeCompare(a.date));

    return {
      purchases,
      subscriptions,
      hasStripeCustomer: customerIds.size > 0,
      error: null,
    };
  } catch (error) {
    return {
      purchases: [],
      subscriptions,
      hasStripeCustomer: storedCustomerIds.length > 0,
      error: error instanceof Error ? error.message : "Failed to load billing.",
    };
  }
}
