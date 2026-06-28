import "server-only";

import type { AdminPaymentRow } from "@/lib/stripe/admin-payment-types";
import { getDisplayName } from "@/lib/profile/display-name";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { tiersFromLineItems } from "@/lib/stripe/sync-purchases";
import { getStripe } from "@/lib/stripe/server";

export type { AdminPaymentRow } from "@/lib/stripe/admin-payment-types";

function formatAmount(amountTotal: number | null, currency: string | null): string | null {
  if (amountTotal == null || !currency) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountTotal / 100);
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
  stripe: ReturnType<typeof getStripe>,
  sessionIds: string[]
) {
  const lineItemsBySession = new Map<string, Awaited<ReturnType<typeof stripe.checkout.sessions.listLineItems>>["data"]>();

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

export async function loadAdminStripePayments(limit = 50): Promise<{
  payments: AdminPaymentRow[];
  error: string | null;
}> {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    return { payments: [], error: "STRIPE_SECRET_KEY is not configured." };
  }

  try {
    const stripe = getStripe();
    const sessions = await stripe.checkout.sessions.list({
      limit: Math.min(limit, 100),
    });

    const paidSessions = sessions.data.filter(
      (session) => session.payment_status === "paid" || session.status === "complete"
    );

    const lineItemsBySession = await loadLineItemsForSessions(
      stripe,
      paidSessions.map((session) => session.id)
    );

    const emails = paidSessions
      .map((session) => session.customer_details?.email ?? session.customer_email ?? null)
      .filter((email): email is string => Boolean(email));

    const userByEmail = await buildEmailToUserMap(emails);

    const payments: AdminPaymentRow[] = paidSessions.map((session) => {
      const lineItems = lineItemsBySession.get(session.id) ?? [];
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
    });

    return { payments, error: null };
  } catch (error) {
    return {
      payments: [],
      error: error instanceof Error ? error.message : "Failed to load Stripe payments.",
    };
  }
}
