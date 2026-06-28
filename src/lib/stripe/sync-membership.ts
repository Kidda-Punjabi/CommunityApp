import {
  findUserIdByEmail,
  grantCoursesToUser,
  syncStripePurchasesForUser,
  tiersFromLineItems,
} from "./sync-purchases";
import { type PaidCourseTier } from "@/lib/membership/access";
import { tierFromStripeIds } from "./products";
import { getStripe } from "./server";
import type Stripe from "stripe";

export { syncStripePurchasesForUser };

async function resolveUserIdFromSession(session: Stripe.Checkout.Session) {
  const fromMetadata =
    session.metadata?.supabase_user_id ?? session.client_reference_id ?? null;
  if (fromMetadata) return fromMetadata;

  const email =
    session.customer_details?.email ??
    session.customer_email ??
    null;

  if (!email) return null;
  return findUserIdByEmail(email);
}

export async function syncMembershipFromCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { updated: false, unlockedTiers: [] as PaidCourseTier[] };
  }

  const userId = await resolveUserIdFromSession(session);
  if (!userId) {
    throw new Error("Could not match checkout session to an app user by email.");
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    expand: ["data.price.product"],
  });

  const purchasedTiers = tiersFromLineItems(lineItems.data);
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  return grantCoursesToUser(userId, purchasedTiers, customerId);
}

export async function syncMembershipFromStripeEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return syncMembershipFromCheckoutSession(session.id);
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    let userId: string | null = subscription.metadata?.supabase_user_id ?? null;

    const stripe = getStripe();
    const full = await stripe.subscriptions.retrieve(subscription.id, {
      expand: ["items.data.price"],
    });

    if (!userId) {
      const customerId =
        typeof full.customer === "string" ? full.customer : full.customer?.id ?? null;
      if (customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        if (!("deleted" in customer) && customer.email) {
          userId = await findUserIdByEmail(customer.email);
        }
      }
    }

    if (!userId) return { updated: false, unlockedTiers: [] as PaidCourseTier[] };

    if (full.status !== "active" && full.status !== "trialing") {
      return { updated: false, unlockedTiers: [] as PaidCourseTier[] };
    }

    const purchasedTiers = full.items.data
      .map((item) => {
        const price = item.price;
        const product = price.product;
        const productId =
          typeof product === "string" ? product : product?.id ?? null;
        const tier = tierFromStripeIds(productId, price.id);
        return tier && tier !== "free" ? tier : null;
      })
      .filter((tier): tier is PaidCourseTier => tier !== null);

    const customerId =
      typeof full.customer === "string" ? full.customer : full.customer?.id ?? null;

    return grantCoursesToUser(userId, purchasedTiers, customerId);
  }

  return { updated: false, unlockedTiers: [] as PaidCourseTier[] };
}
