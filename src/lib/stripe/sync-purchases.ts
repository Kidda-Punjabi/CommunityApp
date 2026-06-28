import type { PaidCourseTier } from "@/lib/membership/access";
import { courseIdsForTiers, fetchCourses } from "@/lib/membership/courses";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { tierFromStripeIds } from "./products";
import { getStripe } from "./server";
import type Stripe from "stripe";

function tiersFromLineItems(
  lineItems: Stripe.LineItem[] | undefined
): PaidCourseTier[] {
  if (!lineItems?.length) return [];

  return lineItems
    .map((item) => {
      const price = item.price;
      const priceId = typeof price === "string" ? price : price?.id;
      const product = price && typeof price !== "string" ? price.product : null;
      const productId =
        typeof product === "string" ? product : product?.id ?? null;

      const tier = tierFromStripeIds(productId, priceId ?? null);
      return tier && tier !== "free" ? tier : null;
    })
    .filter((tier): tier is PaidCourseTier => tier !== null);
}

function addTiersFromSubscription(
  tiers: Set<PaidCourseTier>,
  subscription: Stripe.Subscription
) {
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return;
  }

  for (const item of subscription.items.data) {
    const price = item.price;
    const product = price.product;
    const productId =
      typeof product === "string" ? product : product?.id ?? null;
    const tier = tierFromStripeIds(productId, price.id);
    if (tier && tier !== "free") tiers.add(tier);
  }
}

export async function collectTiersForCustomer(
  stripe: Stripe,
  customerId: string
): Promise<Set<PaidCourseTier>> {
  const tiers = new Set<PaidCourseTier>();

  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    limit: 100,
  });

  for (const session of sessions.data) {
    if (session.payment_status !== "paid") continue;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
    });

    for (const tier of tiersFromLineItems(lineItems.data)) {
      tiers.add(tier);
    }
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
    expand: ["data.items.data.price"],
  });

  for (const subscription of subscriptions.data) {
    addTiersFromSubscription(tiers, subscription);
  }

  return tiers;
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const normalized = email.trim().toLowerCase();

  let page = 1;
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalized
    );
    if (match) return match.id;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

export async function grantCoursesToUser(
  userId: string,
  purchasedTiers: PaidCourseTier[],
  stripeCustomerId: string | null
) {
  const uniqueTiers = [...new Set(purchasedTiers)];
  if (!uniqueTiers.length) {
    return { updated: false, unlockedTiers: [] as PaidCourseTier[] };
  }

  const supabase = createServiceRoleClient();
  const courses = await fetchCourses(supabase);
  const courseIds = courseIdsForTiers(courses, uniqueTiers);

  if (courseIds.size === 0) {
    return { updated: false, unlockedTiers: [] as PaidCourseTier[] };
  }

  const { error: accessError } = await supabase.from("course_access").upsert(
    [...courseIds].map((courseId) => ({
      user_id: userId,
      course_id: courseId,
    })),
    { onConflict: "user_id,course_id" }
  );

  if (accessError) throw new Error(accessError.message);

  // Keep tier table in sync for legacy tooling / reporting
  await supabase.from("profile_course_access").upsert(
    uniqueTiers.map((courseTier) => ({
      user_id: userId,
      course_tier: courseTier,
    })),
    { onConflict: "user_id,course_tier" }
  );

  if (stripeCustomerId) {
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", userId);
  }

  return { updated: true, unlockedTiers: uniqueTiers };
}

/** Look up Stripe purchases by email and sync course access for this user. */
export async function syncStripePurchasesForUser(userId: string, email: string) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { updated: false, unlockedTiers: [] as PaidCourseTier[] };
  }

  const stripe = getStripe();
  const supabase = createServiceRoleClient();
  const tiers = new Set<PaidCourseTier>();
  let primaryCustomerId: string | null = null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  const customerIds = new Set<string>();
  if (profile?.stripe_customer_id) {
    customerIds.add(profile.stripe_customer_id);
    primaryCustomerId = profile.stripe_customer_id;
  }

  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers.data) {
    customerIds.add(customer.id);
    if (!primaryCustomerId) primaryCustomerId = customer.id;
  }

  for (const customerId of customerIds) {
    const customerTiers = await collectTiersForCustomer(stripe, customerId);
    for (const tier of customerTiers) tiers.add(tier);
  }

  const unlockedTiers = [...tiers];
  if (!unlockedTiers.length) {
    return { updated: false, unlockedTiers: [] as PaidCourseTier[] };
  }

  return grantCoursesToUser(userId, unlockedTiers, primaryCustomerId);
}

export { tiersFromLineItems };
