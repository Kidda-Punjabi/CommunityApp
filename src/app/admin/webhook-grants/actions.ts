"use server";

import { requireCommunityLead } from "@/lib/admin/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { RetryWebhookGrantsResult } from "@/lib/stripe/retry-webhook-grants";

export type ActionResult = { error?: string; success?: string };

async function requireAdminFromActions() {
  const supabase = createServiceRoleClient();
  await requireCommunityLead(supabase);
  return supabase;
}

export async function fetchUnmatchedWebhookGrants(): Promise<{
  events: Awaited<ReturnType<typeof import("@/lib/stripe/verify-webhook-grant").findUnmatchedWebhookGrants>>;
  error?: string;
}> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { findUnmatchedWebhookGrants } = await import("@/lib/stripe/verify-webhook-grant");
    
    const events = await findUnmatchedWebhookGrants(supabase, {
      minAgeMinutes: 5,
      maxRetries: 10,
      limit: 100,
    });

    return { events };
  } catch (e) {
    return {
      events: [],
      error: e instanceof Error ? e.message : "Failed to load unmatched webhook grants.",
    };
  }
}

export async function retryWebhookGrantsAction(): Promise<ActionResult & { result?: RetryWebhookGrantsResult }> {
  try {
    await requireAdminFromActions();
    const { retryWebhookGrants } = await import("@/lib/stripe/retry-webhook-grants");
    
    const result = await retryWebhookGrants({
      minAgeMinutes: 5,
      maxRetries: 10,
      limit: 50,
    });

    if (result.errors.length > 0) {
      return {
        error: result.errors.join("; "),
        result,
      };
    }

    return {
      success: `Checked ${result.checked} events: ${result.completed} completed, ${result.stillPending} still pending, ${result.failed} failed`,
      result,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to retry webhook grants.",
    };
  }
}

export async function retrySpecificWebhookGrantAction(eventId: string): Promise<ActionResult> {
  try {
    await requireAdminFromActions();
    const supabase = createServiceRoleClient();
    const { retryWebhookGrants } = await import("@/lib/stripe/retry-webhook-grants");
    
    // Get the specific event
    const { data: event } = await supabase
      .from("stripe_webhook_events")
      .select("id, grant_email, grant_profile_id")
      .eq("id", eventId)
      .single();

    if (!event) {
      return { error: "Event not found" };
    }

    // If it has an email but no profile, try to find and match the profile
    if (event.grant_email && !event.grant_profile_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, notion_lead_page_id")
        .eq("email", event.grant_email)
        .maybeSingle();

      if (profile && profile.notion_lead_page_id) {
        const { grantAccessFromLinkedLeadPackages } = await import(
          "@/lib/notion/lead-purchase-access-grant"
        );
        const { logStripeWebhookGrantAttempt } = await import("@/lib/stripe/webhook-event-log");

        const grantResult = await grantAccessFromLinkedLeadPackages(
          supabase,
          profile.id,
          profile.notion_lead_page_id
        );

        if (grantResult.granted > 0) {
          await logStripeWebhookGrantAttempt({
            eventId: event.id,
            profileId: profile.id,
            status: "completed",
          });
          return { success: "Access granted successfully" };
        } else if (grantResult.queued > 0) {
          return { error: "Grant queued for manual resolution (ambiguous packages)" };
        } else {
          return { error: grantResult.errors.join("; ") || "Grant failed" };
        }
      } else if (profile) {
        return { error: "Profile found but not linked to Notion lead (no App User ID)" };
      } else {
        return { error: "No profile found for this email" };
      }
    }

    // Run general retry logic
    const result = await retryWebhookGrants({
      minAgeMinutes: 0, // Don't filter by age for manual retry
      maxRetries: 100, // Allow retrying even heavily retried events
      limit: 1,
    });

    if (result.completed > 0) {
      return { success: "Access granted successfully" };
    } else if (result.stillPending > 0) {
      return { error: "Still pending - user may not have signed up yet" };
    } else {
      return { error: result.errors.join("; ") || "Retry failed" };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to retry webhook grant.",
    };
  }
}
