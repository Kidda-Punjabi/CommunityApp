export type PremiumCheckoutKey = "premium-quarterly" | "premium-annual";

export const PREMIUM_CHECKOUT_KEYS: PremiumCheckoutKey[] = [
  "premium-quarterly",
  "premium-annual",
];

export const PREMIUM_UNLOCK_PATH = "/dashboard/membership/premium";

export function isPremiumCheckoutKey(key: string): key is PremiumCheckoutKey {
  return key === "premium-quarterly" || key === "premium-annual";
}

export function premiumPriceIds() {
  return {
    quarterly: process.env.STRIPE_PREMIUM_QUARTERLY_PRICE_ID?.trim() || null,
    annual: process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID?.trim() || null,
  };
}

export function resolvePremiumPriceId(key: PremiumCheckoutKey): string | null {
  const ids = premiumPriceIds();
  const priceId = key === "premium-quarterly" ? ids.quarterly : ids.annual;
  if (!priceId?.startsWith("price_")) return null;
  return priceId;
}

export function isPremiumCheckoutConfigured(key?: PremiumCheckoutKey): boolean {
  if (key) return Boolean(resolvePremiumPriceId(key));
  const ids = premiumPriceIds();
  return Boolean(
    (ids.quarterly?.startsWith("price_") ?? false) ||
      (ids.annual?.startsWith("price_") ?? false)
  );
}
