import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import type { SupabaseClient } from "@supabase/supabase-js";

export function grantsPaidCourseAccess(status: PackageMembershipStatus): boolean {
  return status === "confirmed";
}

export async function syncPackageCourseAccess(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  status: PackageMembershipStatus
): Promise<{ error?: string }> {
  if (grantsPaidCourseAccess(status)) {
    const { error } = await supabase.from("course_access").upsert(
      {
        user_id: userId,
        course_id: courseId,
        granted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id" }
    );
    if (error) return { error: error.message };
    return {};
  }

  const { data: otherConfirmed, error: checkError } = await supabase
    .from("student_packages")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("status", "confirmed")
    .limit(1);

  if (checkError) return { error: checkError.message };
  if ((otherConfirmed ?? []).length > 0) return {};

  const { error } = await supabase
    .from("course_access")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) return { error: error.message };

  return {};
}
