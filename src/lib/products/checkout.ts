import type { ProductSlug } from "./content";

export type CheckoutKey =
  | "foundational-refresher"
  | "foundational-full"
  | "beginners"
  | "community";

export type CheckoutConfig = {
  key: CheckoutKey;
  priceIdEnv: string;
  paymentLinkEnv: string;
  mode: "payment" | "subscription";
  label: string;
  productSlug: ProductSlug;
};

export const CHECKOUT_CONFIGS: CheckoutConfig[] = [
  {
    key: "foundational-refresher",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_FOUNDATIONAL_REFRESHER",
    paymentLinkEnv: "STRIPE_PAYMENT_LINK_FOUNDATIONAL_REFRESHER",
    mode: "payment",
    label: "Foundational Crash Course",
    productSlug: "foundational",
  },
  {
    key: "foundational-full",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_FOUNDATIONAL_FULL",
    paymentLinkEnv: "STRIPE_PAYMENT_LINK_FOUNDATIONAL_FULL",
    mode: "payment",
    label: "Full Foundational Course",
    productSlug: "foundational",
  },
  {
    key: "beginners",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_BEGINNERS",
    paymentLinkEnv: "STRIPE_PAYMENT_LINK_BEGINNERS",
    mode: "payment",
    label: "Beginners Course",
    productSlug: "beginners",
  },
  {
    key: "community",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_COMMUNITY",
    paymentLinkEnv: "STRIPE_PAYMENT_LINK_COMMUNITY",
    mode: "subscription",
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
  if (!priceId?.startsWith("price_")) return null;
  return priceId;
}

export function getPaymentLinkForCheckout(key: string): string | null {
  const config = getCheckoutConfig(key);
  if (!config) return null;
  const url = process.env[config.paymentLinkEnv]?.trim();
  if (!url?.startsWith("https://")) return null;
  return url;
}

export function isCheckoutConfigured(key: string): boolean {
  return Boolean(getPriceIdForCheckout(key) || getPaymentLinkForCheckout(key));
}

export function isEmbeddedCheckoutConfigured(key: string): boolean {
  return Boolean(getPriceIdForCheckout(key) && getStripePublishableKey());
}

export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!key?.startsWith("pk_")) return null;
  return key;
}
