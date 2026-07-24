import "server-only";

import { PREMIUM_PAYMENT_LINK_URLS } from "@/lib/products/premium-checkout";
import { getStripe } from "@/lib/stripe/server";
import type Stripe from "stripe";

function normalizePaymentLinkUrl(url: string): string {
  return url.trim().replace(/\/$/, "").split("?")[0] ?? url;
}

const PREMIUM_LINK_TARGETS = Object.values(PREMIUM_PAYMENT_LINK_URLS).map(
  normalizePaymentLinkUrl
);

let cachedPremiumPaymentLinkIds: string[] | null | undefined;

/**
 * Resolve Stripe payment-link ids (plink_…) for Premium buy.stripe.com URLs.
 * Cached in-process after the first successful lookup.
 */
export async function resolvePremiumPaymentLinkIds(): Promise<string[]> {
  if (cachedPremiumPaymentLinkIds !== undefined) {
    return cachedPremiumPaymentLinkIds ?? [];
  }

  try {
    const stripe = getStripe();
    const matched = new Set<string>();
    let startingAfter: string | undefined;

    for (let page = 0; page < 5; page += 1) {
      const list = await stripe.paymentLinks.list({
        limit: 100,
        active: true,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const link of list.data) {
        if (!link.url) continue;
        if (PREMIUM_LINK_TARGETS.includes(normalizePaymentLinkUrl(link.url))) {
          matched.add(link.id);
        }
      }

      if (matched.size >= PREMIUM_LINK_TARGETS.length) break;
      if (!list.has_more || list.data.length === 0) break;
      startingAfter = list.data[list.data.length - 1]?.id;
    }

    cachedPremiumPaymentLinkIds = [...matched];
    return cachedPremiumPaymentLinkIds;
  } catch (error) {
    console.error("[premium] failed to resolve payment link ids:", error);
    cachedPremiumPaymentLinkIds = null;
    return [];
  }
}

export async function isPremiumPaymentLinkSession(
  session: Stripe.Checkout.Session
): Promise<boolean> {
  if (session.metadata?.checkout_key?.startsWith("premium")) return true;

  const paymentLink =
    typeof session.payment_link === "string"
      ? session.payment_link
      : session.payment_link?.id ?? null;

  if (!paymentLink) return false;

  const premiumIds = await resolvePremiumPaymentLinkIds();
  return premiumIds.includes(paymentLink);
}
