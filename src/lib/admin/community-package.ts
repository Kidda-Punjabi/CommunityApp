import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncPackageCourseAccess, grantsPaidCourseAccess } from "@/lib/admin/package-course-access";

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
  return grantsPaidCourseAccess(status);
}

export async function syncCommunityCourseAccess(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  status: PackageMembershipStatus
): Promise<{ error?: string }> {
  return syncPackageCourseAccess(supabase, userId, courseId, status);
}
