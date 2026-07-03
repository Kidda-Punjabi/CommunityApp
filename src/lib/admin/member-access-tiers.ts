import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAID_MEMBERSHIP_STATUSES: PackageMembershipStatus[] = [
  "confirmed",
  "waiting_for_payment",
  "interested",
];

export async function loadAccessTiersByUserId(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, Set<string>>> {
  const tiersByUser = new Map<string, Set<string>>();
  if (userIds.length === 0) return tiersByUser;

  const [{ data: accessRows }, { data: courses }, { data: studentPackages }] = await Promise.all([
    supabase.from("course_access").select("user_id, course_id").in("user_id", userIds),
    supabase.from("courses").select("id, required_tier"),
    supabase
      .from("student_packages")
      .select("user_id, course_id, status, courses(required_tier)")
      .in("user_id", userIds)
      .in("status", PAID_MEMBERSHIP_STATUSES),
  ]);

  const tierByCourseId = new Map(
    (courses ?? []).map((course) => [course.id, course.required_tier ?? ""] as const)
  );

  function addTier(userId: string, tier: string | null | undefined) {
    if (!tier) return;
    const set = tiersByUser.get(userId) ?? new Set<string>();
    set.add(tier);
    tiersByUser.set(userId, set);
  }

  for (const row of accessRows ?? []) {
    addTier(row.user_id, tierByCourseId.get(row.course_id));
  }

  for (const row of studentPackages ?? []) {
    if (row.status !== "confirmed") continue;
    const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    addTier(row.user_id, course?.required_tier ?? tierByCourseId.get(row.course_id));
  }

  return tiersByUser;
}
