import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Distinct members whose last streak-qualifying activity was on p_activity_date.
 * Requires supabase/members-studied-today.sql. Returns null if the RPC is unavailable.
 */
export async function loadMembersStudiedToday(
  supabase: SupabaseClient,
  activityDate: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc("count_members_studied_on_date", {
    p_activity_date: activityDate,
  });

  if (error) return null;
  return typeof data === "number" ? data : 0;
}

export function formatMembersStudiedTodayLabel(count: number | null): string | null {
  if (count == null) return null;
  if (count <= 0) return "Be the first to study today";
  if (count === 1) return "1 member studied today";
  return `${count} members studied today`;
}
