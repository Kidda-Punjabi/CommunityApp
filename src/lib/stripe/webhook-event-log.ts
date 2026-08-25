import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type Stripe from "stripe";

export type WebhookProcessingStatus = "received" | "processed" | "ignored" | "failed";

export type WebhookGrantStatus = 
  | "not_applicable"  // Non-course payment (e.g. Premium, booking credit)
  | "pending"         // Payment succeeded, awaiting profile match/signup
  | "completed"       // All 4 access records created successfully
  | "failed"          // Grant attempted but errored
  | "needs_retry";    // Incomplete grant (e.g. missing App User ID in Notion)

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

/**
 * Determine initial grant status for a checkout session.
 * Returns status and email for tracking.
 */
function initialGrantStatusFromSession(
  session: Stripe.Checkout.Session
): { status: WebhookGrantStatus; email: string | null } {
  // Premium subscriptions are handled separately, not course grants
  const checkoutKey = session.metadata?.checkout_key?.trim() ?? "";
  if (checkoutKey.startsWith("premium")) {
    return { status: "not_applicable", email: null };
  }

  // Booking credit purchases don't grant course access
  const oneToOneBookingId = session.metadata?.one_to_one_booking_id?.trim();
  if (oneToOneBookingId) {
    return { status: "not_applicable", email: null };
  }

  // Payment not completed yet
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { status: "not_applicable", email: null };
  }

  // Course purchases that need access grants
  const hasCourseCheckoutKey = Boolean(
    checkoutKey &&
      (checkoutKey.includes("foundational") ||
        checkoutKey.includes("beginners") ||
        checkoutKey.includes("community") ||
        checkoutKey.includes("kids"))
  );

  if (hasCourseCheckoutKey || session.metadata?.cohort_id) {
    const email = session.customer_details?.email ?? session.customer_email ?? null;
    return { status: "pending", email };
  }

  return { status: "not_applicable", email: null };
}

/** Best-effort insert — never throws (logging must not break webhook ACK). */
export async function logStripeWebhookReceived(event: Stripe.Event): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    
    let grantStatus: WebhookGrantStatus = "not_applicable";
    let grantEmail: string | null = null;
    
    // Track grant status for checkout.session.completed events
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const initial = initialGrantStatusFromSession(session);
      grantStatus = initial.status;
      grantEmail = initial.email;
    }

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
        grant_status: grantStatus,
        grant_email: grantEmail,
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

/**
 * Update grant tracking for a webhook event.
 * Called after attempting to grant access from a payment.
 */
export async function logStripeWebhookGrantAttempt(params: {
  eventId?: string;
  sessionId?: string | null;
  profileId?: string | null;
  email?: string | null;
  status: WebhookGrantStatus;
  error?: string | null;
}): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
      grant_status: params.status,
      grant_attempted_at: now,
      grant_error: params.error ?? null,
    };

    if (params.profileId) {
      update.grant_profile_id = params.profileId;
    }
    if (params.email) {
      update.grant_email = params.email;
    }
    if (params.status === "completed") {
      update.grant_completed_at = now;
    }

    // Build the query - try multiple matching strategies
    let query = admin.from("stripe_webhook_events").update(update);
    
    if (params.eventId) {
      query = query.eq("id", params.eventId);
    } else if (params.sessionId) {
      query = query.eq("checkout_session_id", params.sessionId);
    } else if (params.email) {
      // Match by email for "payment before signup" case
      query = query
        .eq("grant_email", params.email)
        .in("grant_status", ["pending", "needs_retry", "failed"]);
    } else {
      console.error("[stripe_webhook_events] logGrantAttempt called without eventId, sessionId, or email");
      return;
    }

    const { error } = await query;
    if (error) {
      console.error("[stripe_webhook_events] failed to log grant attempt:", error.message);
    }
  } catch (error) {
    console.error("[stripe_webhook_events] failed to log grant attempt:", error);
  }
}

/**
 * Mark a webhook event's grant as needing retry.
 * Increments retry count and updates last retry timestamp.
 */
export async function logStripeWebhookGrantRetry(
  eventId: string,
  status: Extract<WebhookGrantStatus, "pending" | "needs_retry" | "failed">
): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const now = new Date().toISOString();

    await admin.rpc("increment_webhook_grant_retry", {
      p_event_id: eventId,
      p_status: status,
      p_retry_at: now,
    });
  } catch (error) {
    // Fallback if RPC doesn't exist yet
    try {
      const admin = createServiceRoleClient();
      const { data: current } = await admin
        .from("stripe_webhook_events")
        .select("grant_retry_count")
        .eq("id", eventId)
        .single();

      await admin
        .from("stripe_webhook_events")
        .update({
          grant_status: status,
          grant_retry_count: (current?.grant_retry_count ?? 0) + 1,
          grant_last_retry_at: new Date().toISOString(),
        })
        .eq("id", eventId);
    } catch (fallbackError) {
      console.error("[stripe_webhook_events] failed to log grant retry:", fallbackError);
    }
  }
}
