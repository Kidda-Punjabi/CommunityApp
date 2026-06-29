import "server-only";

import { getAppUrl } from "@/lib/stripe/server";
import { getCheckoutConfig, getPriceIdForCheckout } from "@/lib/products/checkout";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Sign in to purchase." }, { status: 401 });
  }

  let checkoutKey: string;
  try {
    const body = (await request.json()) as { checkoutKey?: string };
    checkoutKey = body.checkoutKey ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const config = getCheckoutConfig(checkoutKey);
  if (!config) {
    return NextResponse.json({ error: "Unknown product." }, { status: 400 });
  }

  const priceId = getPriceIdForCheckout(checkoutKey);
  if (!priceId) {
    return NextResponse.json(
      { error: "Checkout price is not configured for this product." },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    if (existing.data[0]) {
      customerId = existing.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { app_user_id: user.id },
      });
      customerId = customer.id;
    }

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: config.mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/membership/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/courses/${config.productSlug}`,
    allow_promotion_codes: config.allowPromotionCodes ?? false,
    metadata: {
      app_user_id: user.id,
      checkout_key: checkoutKey,
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
