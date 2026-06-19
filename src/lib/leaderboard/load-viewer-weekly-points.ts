import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentWeekStart } from "./week";

export async function loadViewerWeeklyPoints(
  supabase: SupabaseClient,
  userId: string,
  weekStart?: string
): Promise<number> {
  const targetWeek = weekStart ?? getCurrentWeekStart();

  const { data } = await supabase
    .from("weekly_points")
    .select("points")
    .eq("user_id", userId)
    .eq("week_start", targetWeek)
    .maybeSingle();

  return data?.points ?? 0;
}
