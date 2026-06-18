import type { SupabaseClient } from "@supabase/supabase-js";

export async function updateUserStreak(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.rpc("update_user_streak", {
    p_user_id: userId,
  });

  if (error) throw error;
}
