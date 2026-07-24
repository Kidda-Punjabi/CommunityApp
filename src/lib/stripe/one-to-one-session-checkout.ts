import "server-only";

import {
  ONE_TO_ONE_SESSION_CHECKOUT_KEY,
  resolveCheckoutPriceId,
  resolvePaymentLinkForCheckout,
} from "@/lib/products/checkout";
import { getStripe } from "@/lib/stripe/server";
import type Stripe from "stripe";

function normalizePaymentLinkUrl(url: string): string {
  return url.trim().replace(/\/$/, "").split("?")[0] ?? url;
}

let cachedPaymentLinkId: string | null | undefined;

/**
 * Resolve the Stripe payment-link id for 1-to-1 session checkout.
 * Prefers STRIPE_PAYMENT_LINK_ONE_TO_ONE_SESSION_PLINK_ID; otherwise looks up
 * the configured buy.stripe.com URL via the Stripe API (cached in-process).
 */
export async function resolveOneToOneSessionPaymentLinkId(): Promise<string | null> {
  const explicit = process.env.STRIPE_PAYMENT_LINK_ONE_TO_ONE_SESSION_PLINK_ID?.trim();
  if (explicit?.startsWith("plink_")) return explicit;

  if (cachedPaymentLinkId !== undefined) return cachedPaymentLinkId;

  const configuredUrl = resolvePaymentLinkForCheckout(ONE_TO_ONE_SESSION_CHECKOUT_KEY);
  if (!configuredUrl) {
    cachedPaymentLinkId = null;
    return null;
  }

  const target = normalizePaymentLinkUrl(configuredUrl);
  try {
    const stripe = getStripe();
    let startingAfter: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const list = await stripe.paymentLinks.list({
        limit: 100,
        active: true,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      const match = list.data.find(
        (link) => link.url && normalizePaymentLinkUrl(link.url) === target
      );
      if (match) {
        cachedPaymentLinkId = match.id;
        return match.id;
      }
      if (!list.has_more || list.data.length === 0) break;
      startingAfter = list.data[list.data.length - 1]?.id;
    }
  } catch (error) {
    console.error("[one-to-one] failed to resolve payment link id:", error);
  }

  cachedPaymentLinkId = null;
  return null;
}

export async function isOneToOneSessionCheckout(
  session: Stripe.Checkout.Session
): Promise<boolean> {
  if (session.metadata?.checkout_key === ONE_TO_ONE_SESSION_CHECKOUT_KEY) {
    return true;
  }

  const paymentLink =
    typeof session.payment_link === "string"
      ? session.payment_link
      : session.payment_link?.id ?? null;

  if (paymentLink) {
    const plinkId = await resolveOneToOneSessionPaymentLinkId();
    if (plinkId && paymentLink === plinkId) return true;
  }

  const configuredPriceId = resolveCheckoutPriceId(ONE_TO_ONE_SESSION_CHECKOUT_KEY);
  if (!configuredPriceId) return false;

  try {
    const stripe = getStripe();
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price"],
    });
    const items = full.line_items?.data ?? [];
    return items.some((item) => {
      const price = item.price;
      const priceId = typeof price === "string" ? price : price?.id;
      return priceId === configuredPriceId;
    });
  } catch (error) {
    console.error("[one-to-one] failed to inspect line items:", error);
    return false;
  }
}
