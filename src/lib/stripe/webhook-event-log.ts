import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type Stripe from "stripe";

export type WebhookProcessingStatus = "received" | "processed" | "ignored" | "failed";

function checkoutSessionIdFromEvent(event: Stripe.Event): string | null {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    return session.id ?? null;
  }
  return null;
}

function summarizeEvent(event: Stripe.Event): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    type: event.type,
    livemode: event.livemode,
  };

  if (event.type.startsWith("checkout.session.")) {
    const session = event.data.object as Stripe.Checkout.Session;
    summary.session_id = session.id;
    summary.payment_status = session.payment_status;
    summary.status = session.status;
    summary.amount_total = session.amount_total;
    summary.payment_link = session.payment_link;
    summary.checkout_key = session.metadata?.checkout_key ?? null;
    summary.one_to_one_booking_id = session.metadata?.one_to_one_booking_id ?? null;
    summary.client_reference_id = session.client_reference_id ?? null;
    summary.email = session.customer_details?.email ?? session.customer_email ?? null;
  }

  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    summary.subscription_id = subscription.id;
    summary.status = subscription.status;
    summary.checkout_key = subscription.metadata?.checkout_key ?? null;
    summary.app_user_id =
      subscription.metadata?.app_user_id ??
      subscription.metadata?.supabase_user_id ??
      null;
  }

  return summary;
}

/** Plain JSON of event.data.object — the session/subscription Stripe actually sent. */
function rawPayloadFromEvent(event: Stripe.Event): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(event.data.object)) as Record<string, unknown>;
  } catch (error) {
    const object = event.data.object as { id?: string };
    return {
      serialize_error: true,
      object_id: object?.id ?? null,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Best-effort insert — never throws (logging must not break webhook ACK). */
export async function logStripeWebhookReceived(event: Stripe.Event): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const { error } = await admin.from("stripe_webhook_events").upsert(
      {
        id: event.id,
        event_type: event.type,
        livemode: event.livemode,
        checkout_session_id: checkoutSessionIdFromEvent(event),
        processing_status: "received",
        payload_summary: summarizeEvent(event),
        raw_payload: rawPayloadFromEvent(event),
        received_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      console.error("[stripe_webhook_events] failed to log received:", error.message);
    }
  } catch (error) {
    console.error("[stripe_webhook_events] failed to log received:", error);
  }
}

export async function logStripeWebhookResult(
  eventId: string,
  status: Exclude<WebhookProcessingStatus, "received">,
  errorMessage?: string | null
): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    await admin
      .from("stripe_webhook_events")
      .update({
        processing_status: status,
        error_message: errorMessage ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId);
  } catch (error) {
    console.error("[stripe_webhook_events] failed to log result:", error);
  }
}
