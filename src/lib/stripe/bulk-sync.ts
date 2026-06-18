import type { PaidCourseTier } from "@/lib/membership/access";
import {
  collectTiersForCustomer,
  findUserIdByEmail,
  grantCoursesToUser,
  syncStripePurchasesForUser,
  tiersFromLineItems,
} from "./sync-purchases";
import { getStripe } from "./server";
import type Stripe from "stripe";

export type BulkSyncStatus =
  | "synced"
  | "dry_run"
  | "no_app_user"
  | "no_purchases"
  | "skipped";

export type BulkSyncResult = {
  email: string;
  stripeCustomerIds: string[];
  tiers: PaidCourseTier[];
  userId: string | null;
  status: BulkSyncStatus;
};

type BulkSyncOptions = {
  limit?: number;
  dryRun?: boolean;
  email?: string;
  maxCheckoutSessions?: number;
};

async function collectPurchasesFromCheckoutSessions(
  stripe: Stripe,
  maxSessions: number
) {
  const byEmail = new Map<
    string,
    { tiers: Set<PaidCourseTier>; customerIds: Set<string> }
  >();

  let startingAfter: string | undefined;
  let scanned = 0;

  while (scanned < maxSessions) {
    const page = await stripe.checkout.sessions.list({
      status: "complete",
      limit: Math.min(100, maxSessions - scanned),
      starting_after: startingAfter,
    });

    for (const session of page.data) {
      if (session.payment_status !== "paid") continue;

      const email = (
        session.customer_details?.email ??
        session.customer_email ??
        ""
      )
        .trim()
        .toLowerCase();

      if (!email) continue;

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ["data.price.product"],
      });

      const tiers = tiersFromLineItems(lineItems.data);
      if (!tiers.length) continue;

      if (!byEmail.has(email)) {
        byEmail.set(email, { tiers: new Set(), customerIds: new Set() });
      }

      const entry = byEmail.get(email)!;
      for (const tier of tiers) entry.tiers.add(tier);

      if (session.customer) {
        entry.customerIds.add(
          typeof session.customer === "string"
            ? session.customer
            : session.customer.id
        );
      }
    }

    scanned += page.data.length;
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  return byEmail;
}

async function mergeCustomerSubscriptions(
  stripe: Stripe,
  byEmail: Map<string, { tiers: Set<PaidCourseTier>; customerIds: Set<string> }>,
  customerLimit: number
) {
  let startingAfter: string | undefined;
  let scanned = 0;

  while (scanned < customerLimit) {
    const page = await stripe.customers.list({
      limit: Math.min(100, customerLimit - scanned),
      starting_after: startingAfter,
    });

    for (const customer of page.data) {
      const email = customer.email?.trim().toLowerCase();
      if (!email) continue;

      const customerTiers = await collectTiersForCustomer(stripe, customer.id);
      if (!customerTiers.size) continue;

      if (!byEmail.has(email)) {
        byEmail.set(email, { tiers: new Set(), customerIds: new Set() });
      }

      const entry = byEmail.get(email)!;
      entry.customerIds.add(customer.id);
      for (const tier of customerTiers) entry.tiers.add(tier);
    }

    scanned += page.data.length;
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
}

export async function bulkSyncStripeCustomers(
  options: BulkSyncOptions = {}
): Promise<BulkSyncResult[]> {
  const stripe = getStripe();
  const limit = options.limit ?? Infinity;
  const dryRun = options.dryRun ?? false;
  const filterEmail = options.email?.trim().toLowerCase();

  const byEmail = await collectPurchasesFromCheckoutSessions(
    stripe,
    options.maxCheckoutSessions ?? 500
  );

  await mergeCustomerSubscriptions(stripe, byEmail, 500);

  if (filterEmail && !byEmail.has(filterEmail)) {
    const userId = await findUserIdByEmail(filterEmail);
    if (!userId) {
      return [
        {
          email: filterEmail,
          stripeCustomerIds: [],
          tiers: [],
          userId: null,
          status: "no_app_user",
        },
      ];
    }

    if (dryRun) {
      const preview = await syncStripePurchasesForUser(userId, filterEmail);
      return [
        {
          email: filterEmail,
          stripeCustomerIds: [],
          tiers: preview.unlockedTiers,
          userId,
          status: preview.unlockedTiers.length ? "dry_run" : "no_purchases",
        },
      ];
    }

    const result = await syncStripePurchasesForUser(userId, filterEmail);
    return [
      {
        email: filterEmail,
        stripeCustomerIds: [],
        tiers: result.unlockedTiers,
        userId,
        status: result.unlockedTiers.length ? "synced" : "no_purchases",
      },
    ];
  }

  const results: BulkSyncResult[] = [];
  let processed = 0;

  const emails = [...byEmail.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [email, { tiers, customerIds }] of emails) {
    if (filterEmail && email !== filterEmail) continue;

    const tierList = [...tiers].sort();
    const customerIdList = [...customerIds];

    if (!tierList.length) {
      results.push({
        email,
        stripeCustomerIds: customerIdList,
        tiers: [],
        userId: null,
        status: "no_purchases",
      });
      continue;
    }

    const userId = await findUserIdByEmail(email);

    if (!userId) {
      results.push({
        email,
        stripeCustomerIds: customerIdList,
        tiers: tierList,
        userId: null,
        status: "no_app_user",
      });
      processed += 1;
      if (processed >= limit) break;
      continue;
    }

    if (dryRun) {
      results.push({
        email,
        stripeCustomerIds: customerIdList,
        tiers: tierList,
        userId,
        status: "dry_run",
      });
    } else {
      await grantCoursesToUser(
        userId,
        tierList,
        customerIdList[0] ?? null
      );
      results.push({
        email,
        stripeCustomerIds: customerIdList,
        tiers: tierList,
        userId,
        status: "synced",
      });
    }

    processed += 1;
    if (processed >= limit) break;
  }

  return results;
}
