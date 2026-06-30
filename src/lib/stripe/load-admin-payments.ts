import "server-only";

import type {
  AdminPaymentRow,
  AdminPaymentsQuery,
  AdminPaymentsResult,
} from "@/lib/stripe/admin-payment-types";
import { getDisplayName } from "@/lib/profile/display-name";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { tiersFromLineItems } from "@/lib/stripe/sync-purchases";
import { getStripe } from "@/lib/stripe/server";
import type Stripe from "stripe";

export type {
  AdminPaymentRow,
  AdminPaymentsQuery,
  AdminPaymentsResult,
} from "@/lib/stripe/admin-payment-types";

const DEFAULT_PAGE_SIZE = 25;
const STRIPE_PAGE_SIZE = 100;
const MAX_STRIPE_PAGES_PER_REQUEST = 12;

function formatAmount(amountTotal: number | null, currency: string | null): string | null {
  if (amountTotal == null || !currency) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountTotal / 100);
}

function stripeCreatedFilter(
  fromDate?: string | null,
  toDate?: string | null
): Stripe.Checkout.SessionListParams["created"] | undefined {
  if (!fromDate && !toDate) return undefined;
  const created: Stripe.RangeQueryParam = {};
  if (fromDate) {
    created.gte = Math.floor(new Date(`${fromDate}T00:00:00.000Z`).getTime() / 1000);
  }
  if (toDate) {
    created.lte = Math.floor(new Date(`${toDate}T23:59:59.999Z`).getTime() / 1000);
  }
  return created;
}

function isPaidSession(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === "paid" || session.status === "complete";
}

function matchesSearch(payment: AdminPaymentRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (payment.email?.toLowerCase().includes(q) ?? false) ||
    (payment.appUserLabel?.toLowerCase().includes(q) ?? false) ||
    payment.products.some((product) => product.toLowerCase().includes(q)) ||
    (payment.amountLabel?.toLowerCase().includes(q) ?? false) ||
    payment.tiers.some((tier) => tier.toLowerCase().includes(q))
  );
}

async function buildEmailToUserMap(
  emails: string[]
): Promise<Map<string, { id: string; label: string }>> {
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const result = new Map<string, { id: string; label: string }>();
  if (normalized.length === 0) return result;

  const supabase = createServiceRoleClient();
  const emailSet = new Set(normalized);
  const matchedUsers: Array<{ id: string; email: string }> = [];

  for (let page = 1; page <= 15; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;

    for (const user of data.users) {
      const email = user.email?.trim().toLowerCase();
      if (!email || !emailSet.has(email)) continue;
      matchedUsers.push({ id: user.id, email });
    }

    if (matchedUsers.length >= normalized.length || data.users.length < 200) break;
  }

  if (matchedUsers.length === 0) return result;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in(
      "id",
      matchedUsers.map((user) => user.id)
    );

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  for (const user of matchedUsers) {
    const profile = profileById.get(user.id);
    result.set(user.email, {
      id: user.id,
      label: getDisplayName(profile) ?? user.email,
    });
  }

  return result;
}

async function loadLineItemsForSessions(
  stripe: Stripe,
  sessionIds: string[]
) {
  const lineItemsBySession = new Map<string, Stripe.LineItem[]>();

  const chunkSize = 8;
  for (let index = 0; index < sessionIds.length; index += chunkSize) {
    const chunk = sessionIds.slice(index, index + chunkSize);
    await Promise.all(
      chunk.map(async (sessionId) => {
        const listed = await stripe.checkout.sessions.listLineItems(sessionId, {
          limit: 10,
          expand: ["data.price.product"],
        });
        lineItemsBySession.set(sessionId, listed.data);
      })
    );
  }

  return lineItemsBySession;
}

function sessionToPaymentRow(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.LineItem[],
  userByEmail: Map<string, { id: string; label: string }>
): AdminPaymentRow {
  const tiers = tiersFromLineItems(lineItems);
  const products = lineItems.map((item) => item.description ?? "Purchase");
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  const appUser = normalizedEmail ? userByEmail.get(normalizedEmail) : undefined;

  return {
    sessionId: session.id,
    createdAt: new Date(session.created * 1000).toISOString(),
    email,
    amountLabel: formatAmount(session.amount_total, session.currency),
    paymentStatus: session.payment_status,
    sessionStatus: session.status ?? "unknown",
    products,
    tiers,
    appUserId: appUser?.id ?? null,
    appUserLabel: appUser?.label ?? null,
    stripeUrl: `https://dashboard.stripe.com/checkout/sessions/${session.id}`,
  };
}

async function mapSessionsToPayments(
  stripe: Stripe,
  sessions: Stripe.Checkout.Session[]
): Promise<AdminPaymentRow[]> {
  if (sessions.length === 0) return [];

  const lineItemsBySession = await loadLineItemsForSessions(
    stripe,
    sessions.map((session) => session.id)
  );

  const emails = sessions
    .map((session) => session.customer_details?.email ?? session.customer_email ?? null)
    .filter((email): email is string => Boolean(email));

  const userByEmail = await buildEmailToUserMap(emails);

  return sessions.map((session) =>
    sessionToPaymentRow(session, lineItemsBySession.get(session.id) ?? [], userByEmail)
  );
}

export async function loadAdminStripePayments(
  query: AdminPaymentsQuery = {}
): Promise<AdminPaymentsResult> {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    return {
      payments: [],
      error: "STRIPE_SECRET_KEY is not configured.",
      hasMore: false,
      nextCursor: null,
    };
  }

  const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 1), 50);
  const search = query.search?.trim() ?? "";
  const created = stripeCreatedFilter(query.fromDate, query.toDate);

  try {
    const stripe = getStripe();
    const payments: AdminPaymentRow[] = [];
    let cursor = query.startingAfter ?? undefined;
    let stripeHasMore = true;
    let pagesFetched = 0;

    while (
      payments.length < pageSize &&
      stripeHasMore &&
      pagesFetched < MAX_STRIPE_PAGES_PER_REQUEST
    ) {
      const page = await stripe.checkout.sessions.list({
        limit: STRIPE_PAGE_SIZE,
        starting_after: cursor,
        created,
      });

      pagesFetched += 1;
      stripeHasMore = page.has_more;

      const lastSession = page.data.at(-1);
      if (!lastSession) {
        stripeHasMore = false;
        break;
      }
      cursor = lastSession.id;

      const paidOnPage = page.data.filter(isPaidSession);
      if (paidOnPage.length === 0) continue;

      const mapped = await mapSessionsToPayments(stripe, paidOnPage);
      for (const payment of mapped) {
        if (search && !matchesSearch(payment, search)) continue;
        payments.push(payment);
        if (payments.length >= pageSize) break;
      }
    }

    const nextCursor = stripeHasMore && cursor ? cursor : null;

    return {
      payments,
      error: null,
      hasMore: Boolean(nextCursor),
      nextCursor,
    };
  } catch (error) {
    return {
      payments: [],
      error: error instanceof Error ? error.message : "Failed to load Stripe payments.",
      hasMore: false,
      nextCursor: null,
    };
  }
}