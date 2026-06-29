import type { ProductSlug } from "./content";

export type CheckoutKey =
  | "foundational-refresher"
  | "foundational-full"
  | "beginners"
  | "community";

export type CheckoutConfig = {
  key: CheckoutKey;
  priceIdEnv: string;
  mode: "payment" | "subscription";
  allowPromotionCodes?: boolean;
  label: string;
  productSlug: ProductSlug;
};

export const CHECKOUT_CONFIGS: CheckoutConfig[] = [
  {
    key: "foundational-refresher",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_FOUNDATIONAL_REFRESHER",
    mode: "payment",
    label: "Foundational Crash Course",
    productSlug: "foundational",
  },
  {
    key: "foundational-full",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_FOUNDATIONAL_FULL",
    mode: "payment",
    label: "Full Foundational Course",
    productSlug: "foundational",
  },
  {
    key: "beginners",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_BEGINNERS",
    mode: "payment",
    label: "Beginners Course",
    productSlug: "beginners",
  },
  {
    key: "community",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_COMMUNITY",
    mode: "subscription",
    allowPromotionCodes: true,
    label: "Kidda Community",
    productSlug: "community",
  },
];

export function getCheckoutConfig(key: string): CheckoutConfig | undefined {
  return CHECKOUT_CONFIGS.find((config) => config.key === key);
}

export function getPriceIdForCheckout(key: string): string | null {
  const config = getCheckoutConfig(key);
  if (!config) return null;
  const priceId = process.env[config.priceIdEnv]?.trim();
  return priceId || null;
}

export function isCheckoutConfigured(key: string): boolean {
  return Boolean(getPriceIdForCheckout(key));
}
