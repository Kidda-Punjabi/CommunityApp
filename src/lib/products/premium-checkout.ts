export type PremiumCheckoutKey = "premium-quarterly" | "premium-annual";

export const PREMIUM_CHECKOUT_KEYS: PremiumCheckoutKey[] = [
  "premium-quarterly",
  "premium-annual",
];

export const PREMIUM_UNLOCK_PATH = "/dashboard/membership/premium";

/** Live Stripe Payment Links managed by Gurupma in the Stripe dashboard. */
export const PREMIUM_PAYMENT_LINK_URLS: Record<PremiumCheckoutKey, string> = {
  "premium-quarterly": "https://buy.stripe.com/6oU9AU3OZbUKgJvdE74ZG0I",
  "premium-annual": "https://buy.stripe.com/28EfZi1GR1g664ReIb4ZG0J",
};

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
