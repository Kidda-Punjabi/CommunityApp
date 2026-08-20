import "server-only";

import {
  resolveCheckoutPriceId,
  resolvePaymentLinkForCheckout,
  SESSION_REBOOK_CHECKOUT_KEY,
} from "@/lib/products/checkout";
import { getStripe } from "@/lib/stripe/server";
import type Stripe from "stripe";

export const SESSION_REBOOK_AMOUNT_PENCE = 3500;
export const SESSION_REBOOK_CURRENCY = "gbp";
export const SESSION_REBOOK_PAYMENT_LINK_URL =
  "https://buy.stripe.com/00wfZigBLgb0dxjeIb4ZG0O";

function normalizePaymentLinkUrl(url: string): string {
  return url.trim().replace(/\/$/, "").split("?")[0] ?? url;
}

let cachedPaymentLinkId: string | null | undefined;

export async function resolveSessionRebookPaymentLinkId(): Promise<string | null> {
  const explicit = process.env.STRIPE_PAYMENT_LINK_SESSION_REBOOK_PLINK_ID?.trim();
  if (explicit?.startsWith("plink_")) return explicit;

  if (cachedPaymentLinkId !== undefined) return cachedPaymentLinkId;

  const configuredUrl =
    resolvePaymentLinkForCheckout(SESSION_REBOOK_CHECKOUT_KEY) ?? SESSION_REBOOK_PAYMENT_LINK_URL;

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
    console.error("[session-rebook] failed to resolve payment link id:", error);
  }

  cachedPaymentLinkId = null;
  return null;
}

export async function isSessionRebookCheckout(
  session: Stripe.Checkout.Session
): Promise<boolean> {
  if (session.metadata?.checkout_key === SESSION_REBOOK_CHECKOUT_KEY) {
    return true;
  }

  const paymentLink =
    typeof session.payment_link === "string"
      ? session.payment_link
      : session.payment_link?.id ?? null;

  if (paymentLink) {
    const plinkId = await resolveSessionRebookPaymentLinkId();
    if (plinkId && paymentLink === plinkId) return true;
  }

  const configuredPriceId = resolveCheckoutPriceId(SESSION_REBOOK_CHECKOUT_KEY);
  if (!configuredPriceId) return false;

  try {
    const stripe = getStripe();
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price"],
    });
    return (full.line_items?.data ?? []).some((item) => {
      const price = item.price;
      const priceId = typeof price === "string" ? price : price?.id;
      return priceId === configuredPriceId;
    });
  } catch (error) {
    console.error("[session-rebook] failed to inspect line items:", error);
    return false;
  }
}

export function buildSessionRebookPaymentUrl(params: {
  pendingRebookingId: string;
  studentEmail: string;
}): string {
  const base =
    resolvePaymentLinkForCheckout(SESSION_REBOOK_CHECKOUT_KEY) ?? SESSION_REBOOK_PAYMENT_LINK_URL;
  const url = new URL(base);
  url.searchParams.set("client_reference_id", params.pendingRebookingId);
  if (params.studentEmail) {
    url.searchParams.set("prefilled_email", params.studentEmail);
  }
  return url.toString();
}

export function assertSessionRebookPayment(session: Stripe.Checkout.Session): {
  ok: true;
} | { ok: false; error: string } {
  if (session.payment_status !== "paid") {
    return { ok: false, error: `payment_status is ${session.payment_status}, expected paid` };
  }
  if (session.amount_total !== SESSION_REBOOK_AMOUNT_PENCE) {
    return {
      ok: false,
      error: `amount_total is ${session.amount_total}, expected ${SESSION_REBOOK_AMOUNT_PENCE}`,
    };
  }
  if ((session.currency ?? "").toLowerCase() !== SESSION_REBOOK_CURRENCY) {
    return {
      ok: false,
      error: `currency is ${session.currency}, expected ${SESSION_REBOOK_CURRENCY}`,
    };
  }
  return { ok: true };
}
