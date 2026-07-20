import {
  findUserIdByEmail,
  grantCoursesToUser,
  syncStripePurchasesForUser,
  tiersFromLineItems,
} from "./sync-purchases";
import { syncStudentPackagesFromPurchases } from "./sync-student-packages-from-payment";
import { completeGroupPurchaseFromCheckoutSession } from "@/lib/group-purchase/complete-group-purchase-after-payment";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { type PaidCourseTier } from "@/lib/membership/access";
import { tierFromStripeIds } from "./products";
import { getStripe } from "./server";
import type Stripe from "stripe";

export { syncStripePurchasesForUser };

async function resolveUserIdFromSession(session: Stripe.Checkout.Session) {
  const fromMetadata =
    session.metadata?.app_user_id ??
    session.metadata?.supabase_user_id ??
    session.client_reference_id ??
    null;
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

  const checkoutKey = session.metadata?.checkout_key ?? null;
  const purchasedAt = new Date(session.created * 1000).toISOString();

  const grantResult = await grantCoursesToUser(userId, purchasedTiers, customerId);
  await syncStudentPackagesFromPurchases(
    userId,
    purchasedTiers.map((tier) => ({
      tier,
      checkoutKey,
      purchasedAt,
      sessionId: session.id,
      mode: session.mode === "subscription" ? "subscription" : "payment",
    }))
  );

  if (session.metadata?.cohort_id) {
    const admin = createServiceRoleClient();
    const groupResult = await completeGroupPurchaseFromCheckoutSession(
      admin,
      userId,
      session.id
    );
    if (groupResult.error) {
      console.error(
        "Group purchase completion error:",
        groupResult.error,
        "session=",
        session.id,
        "user=",
        userId
      );
    } else if (!groupResult.completed && !groupResult.placementPending) {
      console.error(
        "Group purchase completion did not run or returned incomplete:",
        "session=",
        session.id,
        "user=",
        userId,
        "cohort_id=",
        session.metadata?.cohort_id ?? null
      );
    }
  }

  return grantResult;
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

    const checkoutKey = full.metadata?.checkout_key ?? "community";
    const purchasedAt = new Date(full.created * 1000).toISOString();

    const grantResult = await grantCoursesToUser(userId, purchasedTiers, customerId);
    return grantResult;
  }

  return { updated: false, unlockedTiers: [] as PaidCourseTier[] };
}
