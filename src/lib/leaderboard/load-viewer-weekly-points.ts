import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentWeekStart } from "./week";

/** XP the user earned in the given week (Monday start). Name kept from the old weekly points. */
export async function loadViewerWeeklyPoints(
  supabase: SupabaseClient,
  userId: string,
  weekStart?: string
): Promise<number> {
  const targetWeek = weekStart ?? getCurrentWeekStart();

  const { data } = await supabase
    .from("xp_awards")
    .select("xp")
    .eq("user_id", userId)
    .eq("activity_week", targetWeek)
    .neq("source", "opening_balance");

  return ((data ?? []) as { xp: number }[]).reduce((sum, row) => sum + Number(row.xp ?? 0), 0);
}
