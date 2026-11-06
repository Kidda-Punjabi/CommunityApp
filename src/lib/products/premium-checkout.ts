export type PremiumCheckoutKey = "premium-quarterly" | "premium-annual";

export const PREMIUM_CHECKOUT_KEYS: PremiumCheckoutKey[] = [
  "premium-quarterly",
  "premium-annual",
];

export const PREMIUM_UNLOCK_PATH = "/dashboard/membership/premium";

/**
 * Older Premium App plans (£30 a quarter, £99 a year). No longer sold on the Premium page,
 * but kept so the webhook still recognises checkouts and renewals from these links.
 */
export const PREMIUM_PAYMENT_LINK_URLS: Record<PremiumCheckoutKey, string> = {
  "premium-quarterly": "https://buy.stripe.com/6oU9AU3OZbUKgJvdE74ZG0I",
  "premium-annual": "https://buy.stripe.com/28EfZi1GR1g664ReIb4ZG0J",
};

/**
 * The one plan sold on the web: Kidda Community with Premium included,
 * £75 for the first 3 months, then £25 a month (Stripe Payment Link, 90-day trial plus £75 upfront).
 * Not in PREMIUM_PAYMENT_LINK_URLS on purpose: these checkouts go through the Community
 * grant in sync-membership, and a confirmed Community package unlocks Premium.
 */
export const MEMBERSHIP_PAYMENT_LINK_URL = "https://buy.stripe.com/8x2aEYclv4si8cZ8jN4ZG1p";

export function membershipPaymentLinkUrl(userId: string, email?: string | null): string {
  const parsed = new URL(MEMBERSHIP_PAYMENT_LINK_URL);
  parsed.searchParams.set("client_reference_id", userId);
  if (email) parsed.searchParams.set("prefilled_email", email);
  return parsed.toString();
}

export function isPremiumCheckoutKey(key: string): key is PremiumCheckoutKey {
  return key === "premium-quarterly" || key === "premium-annual";
}

export function premiumPaymentLinkUrl(
  key: PremiumCheckoutKey,
  userId: string
): string {
  const parsed = new URL(PREMIUM_PAYMENT_LINK_URLS[key]);
  parsed.searchParams.set("client_reference_id", userId);
  return parsed.toString();
}

export function isPremiumCheckoutConfigured(_key?: PremiumCheckoutKey): boolean {
  return true;
}

/** Optional price IDs for webhook line-item matching (Payment Links remain the buy path). */
export function premiumPriceIds() {
  return {
    quarterly: process.env.STRIPE_PREMIUM_QUARTERLY_PRICE_ID?.trim() || null,
    annual: process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID?.trim() || null,
  };
}
