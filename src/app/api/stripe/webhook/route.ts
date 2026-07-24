import { syncBookingCreditFromStripeEvent } from "@/lib/stripe/sync-booking-credit";
import { syncMembershipFromStripeEvent } from "@/lib/stripe/sync-membership";
import { syncPremiumFromStripeEvent } from "@/lib/stripe/sync-premium-membership";
import {
  logStripeWebhookReceived,
  logStripeWebhookResult,
} from "@/lib/stripe/webhook-event-log";
import { getStripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await logStripeWebhookReceived(event);

  try {
    const bookingResult = await syncBookingCreditFromStripeEvent(event);
    await syncPremiumFromStripeEvent(event);
    await syncMembershipFromStripeEvent(event);
    await logStripeWebhookResult(
      event.id,
      bookingResult === "processed" ? "processed" : "ignored"
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed.";
    console.error("Stripe webhook error:", message, "event=", event.id, "type=", event.type);
    await logStripeWebhookResult(event.id, "failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
