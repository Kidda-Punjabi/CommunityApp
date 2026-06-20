import Stripe from "stripe";
import { getPublicAppUrl } from "@/lib/app-url";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }

  return stripeClient;
}

export function getAppUrl(): string {
  return getPublicAppUrl();
}
