import {
  appendPaymentLinkParams,
  createCheckoutSession,
} from "@/lib/stripe/create-checkout-session";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  let checkoutKey: string;
  let embedded = false;

  try {
    const body = (await request.json()) as { checkoutKey?: string; embedded?: boolean };
    checkoutKey = body.checkoutKey ?? "";
    embedded = Boolean(body.embedded);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await createCheckoutSession({ checkoutKey, embedded });

    if (result.type === "payment_link") {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      return NextResponse.json({
        url: appendPaymentLinkParams(result.url, {
          email: user?.email,
          clientReferenceId: user?.id,
        }),
      });
    }

    if (result.type === "embedded") {
      return NextResponse.json({ clientSecret: result.clientSecret });
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    const status = message.includes("not configured") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
