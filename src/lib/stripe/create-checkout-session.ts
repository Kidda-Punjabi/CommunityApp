import "server-only";

import {
  getCheckoutConfig,
  resolveCheckoutPriceId,
  resolvePaymentLinkForCheckout,
} from "@/lib/products/checkout";
import { getAppUrl, getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

type CreateCheckoutSessionOptions = {
  checkoutKey: string;
  embedded?: boolean;
};

async function resolveStripeCustomerId(userId: string, email: string): Promise<string> {
  const stripe = getStripe();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data[0]) {
      customerId = existing.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { app_user_id: userId },
      });
      customerId = customer.id;
    }

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  return customerId;
}

export async function createCheckoutSession({
  checkoutKey,
  embedded = false,
}: CreateCheckoutSessionOptions) {
  const config = getCheckoutConfig(checkoutKey);
  if (!config) {
    throw new Error("Unknown product.");
  }

  const priceId = resolveCheckoutPriceId(checkoutKey);
  const paymentLink = resolvePaymentLinkForCheckout(checkoutKey);

  if (!priceId && !paymentLink) {
    throw new Error("Checkout is not configured for this product.");
  }

  if (!priceId && paymentLink) {
    return { type: "payment_link" as const, url: paymentLink };
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const successPath = `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const customerId = user?.email ? await resolveStripeCustomerId(user.id, user.email) : undefined;

  const baseParams = {
    mode: config.mode,
    line_items: [{ price: priceId!, quantity: 1 }],
    allow_promotion_codes: true as const,
    metadata: {
      checkout_key: checkoutKey,
      ...(user?.id ? { app_user_id: user.id } : {}),
    },
    ...(customerId ? { customer: customerId } : {}),
  };

  const session = embedded
    ? await stripe.checkout.sessions.create({
        ...baseParams,
        ui_mode: "embedded_page",
        return_url: successPath,
      })
    : await stripe.checkout.sessions.create({
        ...baseParams,
        success_url: successPath,
        cancel_url: `${appUrl}/courses/${config.productSlug}`,
      });

  if (embedded) {
    if (!session.client_secret) {
      throw new Error("Could not create embedded checkout session.");
    }
    return { type: "embedded" as const, clientSecret: session.client_secret };
  }

  if (!session.url) {
    throw new Error("Could not create checkout session.");
  }

  return { type: "hosted" as const, url: session.url };
}

export function appendPaymentLinkEmail(url: string, email: string | null | undefined): string {
  if (!email?.trim()) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("prefilled_email", email.trim());
  return parsed.toString();
}
