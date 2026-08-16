import type { ProductSlug } from "./content";

export type CheckoutKey =
  | "foundational-refresher"
  | "foundational-full"
  | "beginners"
  | "beginners-group"
  | "beginners-one-to-one"
  | "beginners-kids-group"
  | "one-to-one-session"
  | "community";

export const ONE_TO_ONE_SESSION_CHECKOUT_KEY = "one-to-one-session" as const;

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
    label: "Beginners Course (Group)",
    productSlug: "beginners",
  },
  {
    key: "beginners-group",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_BEGINNERS_GROUP",
    paymentLinkEnv: "STRIPE_PAYMENT_LINK_BEGINNERS_GROUP",
    mode: "payment",
    label: "Beginners Course (Group)",
    productSlug: "beginners",
  },
  {
    key: "beginners-one-to-one",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_BEGINNERS_ONE_TO_ONE",
    paymentLinkEnv: "STRIPE_PAYMENT_LINK_BEGINNERS_ONE_TO_ONE",
    mode: "payment",
    label: "Beginners Course (1-to-1)",
    productSlug: "beginners",
  },
  {
    key: "beginners-kids-group",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_BEGINNERS_KIDS_GROUP",
    paymentLinkEnv: "STRIPE_PAYMENT_LINK_BEGINNERS_KIDS_GROUP",
    mode: "payment",
    label: "Kids Beginners Course (Group)",
    productSlug: "beginners-kids",
  },
  {
    key: "one-to-one-session",
    priceIdEnv: "STRIPE_CHECKOUT_PRICE_ONE_TO_ONE_SESSION",
    paymentLinkEnv: "STRIPE_PAYMENT_LINK_ONE_TO_ONE_SESSION",
    mode: "payment",
    label: "1-to-1 tutoring session",
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

export function resolveCheckoutPriceId(key: string): string | null {
  const direct = getPriceIdForCheckout(key);
  if (direct) return direct;
  if (key === "beginners-group") return getPriceIdForCheckout("beginners");
  if (key === "beginners-kids-group") {
    return (
      getPriceIdForCheckout("beginners-group") ?? getPriceIdForCheckout("beginners")
    );
  }
  return null;
}

export function getPaymentLinkForCheckout(key: string): string | null {
  const config = getCheckoutConfig(key);
  if (!config) return null;
  const url = process.env[config.paymentLinkEnv]?.trim();
  if (!url?.startsWith("https://")) return null;
  return url;
}

export function resolvePaymentLinkForCheckout(key: string): string | null {
  const direct = getPaymentLinkForCheckout(key);
  if (direct) return direct;
  if (key === "beginners-group") return getPaymentLinkForCheckout("beginners");
  if (key === "beginners-kids-group") {
    return (
      getPaymentLinkForCheckout("beginners-group") ??
      getPaymentLinkForCheckout("beginners")
    );
  }
  if (key === ONE_TO_ONE_SESSION_CHECKOUT_KEY) {
    return "https://buy.stripe.com/8x2cN62KV3oeeBncA34ZG0C";
  }
  return null;
}

export function isCheckoutConfigured(key: string): boolean {
  return Boolean(resolveCheckoutPriceId(key) || resolvePaymentLinkForCheckout(key));
}

export function isEmbeddedCheckoutConfigured(key: string): boolean {
  return Boolean(resolveCheckoutPriceId(key) && getStripePublishableKey());
}

export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!key?.startsWith("pk_")) return null;
  return key;
}
