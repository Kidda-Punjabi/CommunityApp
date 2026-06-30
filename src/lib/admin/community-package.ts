import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COMMUNITY_PACKAGE_SLUG = "community";

export type CommunityPackageProduct = {
  id: string;
  name: string;
  courseId: string;
  active: boolean;
};

export async function fetchCommunityPackageProduct(
  supabase: SupabaseClient
): Promise<CommunityPackageProduct | null> {
  const { data } = await supabase
    .from("packages")
    .select("id, name, course_id, active")
    .eq("slug", COMMUNITY_PACKAGE_SLUG)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    courseId: data.course_id,
    active: data.active,
  };
}

export function grantsCommunityCourseAccess(status: PackageMembershipStatus): boolean {
  return status === "confirmed";
}

export async function syncCommunityCourseAccess(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  status: PackageMembershipStatus
): Promise<{ error?: string }> {
  if (grantsCommunityCourseAccess(status)) {
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

  const { error } = await supabase
    .from("course_access")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) return { error: error.message };

  return {};
}
