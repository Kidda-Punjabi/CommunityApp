import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const HOLD_MINUTES = 20;

export function cohortHoldExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + HOLD_MINUTES * 60 * 1000).toISOString();
}

export async function countActiveCohortMembers(
  supabase: SupabaseClient,
  cohortId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("cohort_members")
    .select("user_id", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .is("left_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countActiveCohortSeatHolds(
  supabase: SupabaseClient,
  cohortId: string,
  options?: { excludeHoldId?: string }
): Promise<number> {
  const now = new Date().toISOString();

  let query = supabase
    .from("cohort_seat_holds")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .gt("expires_at", now);

  if (options?.excludeHoldId) {
    query = query.neq("id", options.excludeHoldId);
  }

  const { count, error } = await query;
  if (error) {
    if (error.message.includes("cohort_seat_holds")) {
      throw new Error(
        `${error.message} Run supabase/cohort-seat-holds.sql in the Supabase SQL Editor, then retry.`
      );
    }
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function countNotionConfirmedSeats(
  supabase: SupabaseClient,
  cohortId: string
): Promise<number> {
  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("notion_confirmed_count")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohortError && cohort && typeof cohort.notion_confirmed_count === "number") {
    return cohort.notion_confirmed_count;
  }

  const { count, error } = await supabase
    .from("package_instance_notion_roster")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .eq("roster_status", "confirmed");

  if (error) {
    if (error.message.includes("package_instance_notion_roster")) {
      return cohort?.notion_confirmed_count ?? 0;
    }
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * Checkout capacity: Notion Confirmed seats + active holds (not app cohort_members).
 */
export async function getCohortCheckoutRemainingSpots(
  supabase: SupabaseClient,
  cohortId: string,
  capacity: number,
  options?: { excludeHoldId?: string; honorHoldId?: string }
): Promise<number> {
  const [confirmed, holds] = await Promise.all([
    countNotionConfirmedSeats(supabase, cohortId),
    countActiveCohortSeatHolds(supabase, cohortId, {
      excludeHoldId: options?.honorHoldId ?? options?.excludeHoldId,
    }),
  ]);

  const honoredHold = options?.honorHoldId ? 1 : 0;
  const used = confirmed + holds + honoredHold;
  return Math.max(0, capacity - used);
}

export async function getCohortRemainingSpots(
  supabase: SupabaseClient,
  cohortId: string,
  capacity: number,
  options?: { excludeHoldId?: string; honorHoldId?: string }
): Promise<number> {
  const [members, holds] = await Promise.all([
    countActiveCohortMembers(supabase, cohortId),
    countActiveCohortSeatHolds(supabase, cohortId, {
      excludeHoldId: options?.honorHoldId ?? options?.excludeHoldId,
    }),
  ]);

  const honoredHold = options?.honorHoldId ? 1 : 0;
  const used = members + holds + honoredHold;
  return Math.max(0, capacity - used);
}
