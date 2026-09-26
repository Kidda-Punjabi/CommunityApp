import "server-only";

import type { SubscriptionStatus } from "@/lib/membership/profile-tier";
import { savePremiumMembership } from "@/lib/stripe/sync-premium-membership";
import { getStripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { markUnmatchedEventsProcessedForSubscription } from "@/lib/stripe/webhook-event-log";
import { setProfileMembershipTier } from "@/lib/membership/premium-access";

type UnmatchedCheckout = {
  id: string;
  payload_summary: {
    email?: string | null;
    subscription_id?: string | null;
    stripe_customer_id?: string | null;
  } | null;
};

function summaryText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Attach unmatched Premium payment-link checkouts to a confirmed account.
 * Only checkout.session.completed rows are used; those carry the email.
 * Safe to call from both signup and the auth callback.
 */
export async function claimUnmatchedPremiumCheckouts(params: {
  userId: string;
  email: string;
}): Promise<void> {
  const email = params.email.trim();
  if (!email) return;

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("stripe_webhook_events")
    .select("id, payload_summary")
    .eq("event_type", "checkout.session.completed")
    .eq("processing_status", "unmatched")
    .filter("payload_summary->>email", "ilike", email);

  if (error) throw error;

  const events = (data ?? []) as UnmatchedCheckout[];
  if (events.length === 0) return;

  const stripe = getStripe();

  for (const event of events) {
    const subscriptionId = summaryText(event.payload_summary?.subscription_id);
    const customerId = summaryText(event.payload_summary?.stripe_customer_id);

    if (!subscriptionId) {
      await admin
        .from("stripe_webhook_events")
        .update({
          processing_status: "ignored",
          error_message: "checkout event missing subscription id",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      continue;
    }

    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (retrieveError) {
      console.error(
        "[premium claim] could not retrieve subscription",
        subscriptionId,
        retrieveError
      );
      continue;
    }

    const status = subscription.status;

    if (status !== "active" && status !== "trialing") {
      const reason =
        status === "canceled"
          ? `subscription ${subscriptionId} was cancelled before claim`
          : `subscription ${subscriptionId} is ${status}; not granting`;
      await admin
        .from("stripe_webhook_events")
        .update({
          processing_status: "ignored",
          error_message: reason,
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      continue;
    }

    const saved = await savePremiumMembership({
      userId: params.userId,
      customerId,
      subscriptionId,
      status: status as SubscriptionStatus,
      mode: "claim",
    });

    if (saved.outcome === "duplicate") {
      await admin
        .from("stripe_webhook_events")
        .update({
          processing_status: "duplicate_subscription",
          error_message: saved.errorMessage,
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      continue;
    }

    if (saved.outcome === "saved") {
      await setProfileMembershipTier(params.userId, "premium");
    }

    try {
      await stripe.subscriptions.update(subscription.id, {
        metadata: {
          ...subscription.metadata,
          app_user_id: params.userId,
          supabase_user_id: params.userId,
          tier_name: "premium",
          checkout_key: subscription.metadata?.checkout_key || "premium",
        },
      });
    } catch (stampError) {
      console.error("[premium claim] failed to stamp subscription metadata:", stampError);
    }

    await admin
      .from("stripe_webhook_events")
      .update({
        processing_status: "processed",
        error_message: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    await markUnmatchedEventsProcessedForSubscription(subscriptionId);
  }
}
