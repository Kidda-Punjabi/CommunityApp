import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KidsPurchaseGrantQueueRow } from "@/lib/admin/kids-purchase-grant-queue-types";

export type { KidsPurchaseGrantQueueRow };
export {
  isKidsPurchaseQueueViewId,
  KIDS_PURCHASE_QUEUE_VIEW_ID,
  KIDS_PURCHASE_QUEUE_VIEW_QUERY,
  selectUnresolvedKidsPurchaseQueueRows,
} from "@/lib/admin/kids-purchase-grant-queue-types";

function asObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function loadKidsPurchaseGrantQueue(
  supabase: SupabaseClient
): Promise<{ rows: KidsPurchaseGrantQueueRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("kids_course_purchase_grant_queue")
    .select(
      "id, stripe_checkout_session_id, parent_email, kid_name, reason, raw_metadata, resolved, created_at, cohort_id, cohorts(name)"
    )
    .eq("resolved", false)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.message.includes("kids_course_purchase_grant_queue")) {
      return { rows: [] };
    }
    return { rows: [], error: error.message };
  }

  const rows = (data ?? []).map((row) => {
    const cohort = asObject(row.cohorts as { name?: string } | { name?: string }[] | null);
    return {
      id: row.id as string,
      stripeCheckoutSessionId: row.stripe_checkout_session_id as string,
      parentEmail: (row.parent_email as string | null) ?? null,
      kidName: (row.kid_name as string | null) ?? null,
      reason: row.reason as string,
      rawMetadata: asMetadata(row.raw_metadata),
      resolved: Boolean(row.resolved),
      createdAt: row.created_at as string,
      cohortId: (row.cohort_id as string | null) ?? null,
      cohortName: cohort?.name ?? null,
    };
  });

  return { rows };
}
