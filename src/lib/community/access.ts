import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Confirmed Kidda Community package (student_packages), not course_access alone. */
export async function hasConfirmedCommunityPackage(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("student_packages")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", COMMUNITY_COURSE_ID)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}
