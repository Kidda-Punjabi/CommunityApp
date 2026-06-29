import "server-only";

import { TIER_LABELS } from "@/lib/membership/tiers";
import { tierFromStripeIds } from "@/lib/stripe/products";
import { tiersFromLineItems } from "@/lib/stripe/sync-purchases";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

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

function formatAmount(amount: number | null, currency: string | null): string | null {
  if (amount == null || !currency) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

async function resolveCustomerIds(
  stripe: Stripe,
  email: string,
  storedCustomerId: string | null
): Promise<string[]> {
  const ids = new Set<string>();
  if (storedCustomerId) ids.add(storedCustomerId);

  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers.data) {
    ids.add(customer.id);
  }

  return [...ids];
}

export async function loadUserBilling(): Promise<{
  purchases: UserPurchaseRow[];
  subscriptions: UserSubscriptionRow[];
  hasStripeCustomer: boolean;
  error: string | null;
}> {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    return {
      purchases: [],
      subscriptions: [],
      hasStripeCustomer: false,
      error: "Billing is not configured.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      purchases: [],
      subscriptions: [],
      hasStripeCustomer: false,
      error: "Not signed in.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  try {
    const stripe = getStripe();
    const customerIds = await resolveCustomerIds(
      stripe,
      user.email,
      profile?.stripe_customer_id ?? null
    );

    if (customerIds.length === 0) {
      return {
        purchases: [],
        subscriptions: [],
        hasStripeCustomer: false,
        error: null,
      };
    }

    const purchases: UserPurchaseRow[] = [];
    const subscriptions: UserSubscriptionRow[] = [];

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

        const tiers = tiersFromLineItems(lineItems.data);
        const products = lineItems.data.map(
          (item) => item.description ?? "Purchase"
        );

        purchases.push({
          id: session.id,
          date: new Date(session.created * 1000).toISOString(),
          amountLabel: formatAmount(session.amount_total, session.currency),
          products,
          tiers,
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

      for (const sub of subs.data) {
        const billingFields = sub as Stripe.Subscription & {
          current_period_end?: number;
          cancel_at_period_end?: boolean;
        };
        const item = sub.items.data[0];
        const price = item?.price;
        const productId =
          typeof price?.product === "string" ? price.product : price?.product?.id ?? null;
        const tier = tierFromStripeIds(productId, price?.id ?? null);
        const productName =
          tier && tier !== "free"
            ? TIER_LABELS[tier]
            : price?.nickname?.trim() || "Subscription";
        subscriptions.push({
          id: sub.id,
          status: sub.status,
          productName,
          amountLabel: formatAmount(price?.unit_amount ?? null, price?.currency ?? null),
          interval: price?.recurring?.interval ?? null,
          currentPeriodEnd: billingFields.current_period_end
            ? new Date(billingFields.current_period_end * 1000).toISOString()
            : null,
          cancelAtPeriodEnd: billingFields.cancel_at_period_end ?? false,
        });
      }
    }

    purchases.sort((a, b) => b.date.localeCompare(a.date));

    return {
      purchases,
      subscriptions,
      hasStripeCustomer: true,
      error: null,
    };
  } catch (error) {
    return {
      purchases: [],
      subscriptions: [],
      hasStripeCustomer: Boolean(profile?.stripe_customer_id),
      error: error instanceof Error ? error.message : "Failed to load billing.",
    };
  }
}
