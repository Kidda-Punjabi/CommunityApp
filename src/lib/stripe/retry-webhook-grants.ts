import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { findUnmatchedWebhookGrants, verifyWebhookGrantCompletion } from "./verify-webhook-grant";
import { logStripeWebhookGrantRetry, logStripeWebhookGrantAttempt } from "./webhook-event-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RetryWebhookGrantsResult = {
  checked: number;
  completed: number;
  stillPending: number;
  failed: number;
  errors: string[];
  details: Array<{
    eventId: string;
    email: string | null;
    status: string;
    message: string;
  }>;
};

/**
 * Retry access grants for webhook events that are still pending/failed.
 * 
 * This handles the "payment before signup" case where:
 * 1. Stripe payment succeeds → webhook creates event with status "pending"
 * 2. User hasn't signed up yet, so no profile to grant to
 * 3. Later, user signs up and gets linked to Notion lead
 * 4. This retry mechanism finds the pending webhook and attempts grant again
 */
export async function retryWebhookGrants(options?: {
  /** Only retry events older than this many minutes */
  minAgeMinutes?: number;
  /** Max retry count before giving up */
  maxRetries?: number;
  /** Limit number of events to process */
  limit?: number;
}): Promise<RetryWebhookGrantsResult> {
  const admin = createServiceRoleClient();
  const result: RetryWebhookGrantsResult = {
    checked: 0,
    completed: 0,
    stillPending: 0,
    failed: 0,
    errors: [],
    details: [],
  };

  try {
    const unmatchedEvents = await findUnmatchedWebhookGrants(admin, options);
    result.checked = unmatchedEvents.length;

    for (const event of unmatchedEvents) {
      try {
        // If we already have a profile and verification shows completion, mark as complete
        if (event.profileId && event.verification?.isComplete) {
          await logStripeWebhookGrantAttempt({
            eventId: event.eventId,
            profileId: event.profileId,
            status: "completed",
          });
          result.completed++;
          result.details.push({
            eventId: event.eventId,
            email: event.email,
            status: "completed",
            message: "Verification confirmed all 4 records exist",
          });
          continue;
        }

        // If we have a profile but verification shows incomplete, mark for retry
        if (event.profileId && event.verification && !event.verification.isComplete) {
          await logStripeWebhookGrantRetry(event.eventId, "needs_retry");
          result.stillPending++;
          result.details.push({
            eventId: event.eventId,
            email: event.email,
            status: "needs_retry",
            message: `Missing: ${event.verification.missingRecords.join(", ")}`,
          });
          continue;
        }

        // Try to find profile by email if we don't have one yet
        if (!event.profileId && event.email) {
          const { data: profile } = await admin
            .from("profiles")
            .select("id, notion_lead_page_id")
            .eq("email", event.email)
            .maybeSingle();

          if (profile) {
            // Profile found! Try to grant access
            if (profile.notion_lead_page_id) {
              // Profile is linked to a Notion lead, attempt grant
              const { grantAccessFromLinkedLeadPackages } = await import(
                "@/lib/notion/lead-purchase-access-grant"
              );
              const grantResult = await grantAccessFromLinkedLeadPackages(
                admin,
                profile.id,
                profile.notion_lead_page_id
              );

              if (grantResult.granted > 0) {
                await logStripeWebhookGrantAttempt({
                  eventId: event.eventId,
                  profileId: profile.id,
                  status: "completed",
                });
                result.completed++;
                result.details.push({
                  eventId: event.eventId,
                  email: event.email,
                  status: "completed",
                  message: `Granted access after matching profile ${profile.id}`,
                });
              } else if (grantResult.queued > 0) {
                await logStripeWebhookGrantRetry(event.eventId, "needs_retry");
                result.stillPending++;
                result.details.push({
                  eventId: event.eventId,
                  email: event.email,
                  status: "needs_retry",
                  message: "Queued for manual resolution (ambiguous packages)",
                });
              } else {
                await logStripeWebhookGrantRetry(event.eventId, "failed");
                result.failed++;
                result.details.push({
                  eventId: event.eventId,
                  email: event.email,
                  status: "failed",
                  message: grantResult.errors.join("; ") || "Grant failed",
                });
              }
            } else {
              // Profile exists but not linked to Notion lead yet
              await logStripeWebhookGrantRetry(event.eventId, "pending");
              result.stillPending++;
              result.details.push({
                eventId: event.eventId,
                email: event.email,
                status: "pending",
                message: "Profile exists but not linked to Notion lead (no App User ID)",
              });
            }
          } else {
            // Still no profile matched
            await logStripeWebhookGrantRetry(event.eventId, "pending");
            result.stillPending++;
            result.details.push({
              eventId: event.eventId,
              email: event.email,
              status: "pending",
              message: "No profile matched email yet",
            });
          }
          continue;
        }

        // No profile and no email - can't proceed
        await logStripeWebhookGrantRetry(event.eventId, "failed");
        result.failed++;
        result.details.push({
          eventId: event.eventId,
          email: event.email,
          status: "failed",
          message: "No profile or email to match",
        });
      } catch (eventError) {
        const message = eventError instanceof Error ? eventError.message : String(eventError);
        result.errors.push(`Event ${event.eventId}: ${message}`);
        result.failed++;
      }
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    return result;
  }
}

/**
 * Retry grants for a specific profile after they sign up or their Notion lead is updated.
 * This is triggered automatically after signup/lead link.
 */
export async function retryWebhookGrantsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  email: string
): Promise<{ retried: number; completed: number }> {
  let retried = 0;
  let completed = 0;

  try {
    // Find pending webhook events for this email
    const { data: events } = await supabase
      .from("stripe_webhook_events")
      .select("id, checkout_session_id, payload_summary")
      .eq("grant_email", email)
      .in("grant_status", ["pending", "needs_retry"])
      .limit(10);

    if (!events || events.length === 0) {
      return { retried: 0, completed: 0 };
    }

    // Get profile's Notion lead page ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("notion_lead_page_id")
      .eq("id", profileId)
      .maybeSingle();

    if (!profile?.notion_lead_page_id) {
      // Profile not linked to Notion lead yet, can't grant
      return { retried: 0, completed: 0 };
    }

    // Attempt grant for each pending event
    const { grantAccessFromLinkedLeadPackages } = await import(
      "@/lib/notion/lead-purchase-access-grant"
    );

    for (const event of events) {
      retried++;
      
      const grantResult = await grantAccessFromLinkedLeadPackages(
        supabase,
        profileId,
        profile.notion_lead_page_id
      );

      if (grantResult.granted > 0) {
        await logStripeWebhookGrantAttempt({
          eventId: event.id,
          profileId,
          status: "completed",
        });
        completed++;
      } else if (grantResult.queued > 0) {
        await logStripeWebhookGrantRetry(event.id, "needs_retry");
      } else {
        await logStripeWebhookGrantRetry(event.id, "failed");
      }
    }

    return { retried, completed };
  } catch (error) {
    console.error(
      `[webhook grant retry] failed for profile ${profileId}:`,
      error instanceof Error ? error.message : error
    );
    return { retried, completed };
  }
}
