import type { SupabaseClient } from "@supabase/supabase-js";
import { getDisplayName } from "@/lib/profile/display-name";

export type CohortMemberOverview = {
  userId: string;
  label: string;
  email: string | null;
  joinedAt: string;
  packageStatus: string | null;
  hasEnrollment: boolean;
  enrollmentDeliveryMode: string | null;
};

export type CohortOverview = {
  id: string;
  name: string;
  courseName: string;
  tutorLabel: string | null;
  active: boolean;
  createdAt: string;
  memberCount: number;
  members: CohortMemberOverview[];
};

export type UnallocatedGroupBuyer = {
  userId: string;
  label: string;
  email: string | null;
  packageStatus: string;
  purchasedAt: string;
};

export type CohortsOverviewData = {
  cohorts: CohortOverview[];
  unallocatedGroupBuyers: UnallocatedGroupBuyer[];
  stats: {
    activeCohorts: number;
    totalAllocated: number;
    unallocatedGroup: number;
    oneToOneBeginners: number;
  };
};

function packageStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_setup: "Pending setup",
    active: "Active",
    paused: "Paused",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

export { packageStatusLabel };

export async function loadCohortsOverview(
  supabase: SupabaseClient
): Promise<{ data: CohortsOverviewData | null; error?: string }> {
  const [
    { data: cohortRows, error: cohortsError },
    { data: courses },
    { data: packageRow },
  ] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name, course_id, tutor_id, active, created_at")
      .order("active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("courses").select("id, name, required_tier"),
    supabase.from("packages").select("id, slug").eq("slug", "beginners-group").maybeSingle(),
  ]);

  if (cohortsError) {
    return { data: null, error: cohortsError.message };
  }

  const courseById = new Map((courses ?? []).map((c) => [c.id, c] as const));
  const beginnersCourseId =
    (courses ?? []).find((c) => c.required_tier === "beginners")?.id ?? null;
  const groupPackageId = packageRow?.id ?? null;

  const cohortIds = (cohortRows ?? []).map((c) => c.id);

  const [
    { data: memberRows },
    { data: profileRows },
    { data: authData },
    { data: enrollmentRows },
    { data: groupPackages },
    { data: oneToOnePackageRow },
  ] = await Promise.all([
    cohortIds.length > 0
      ? supabase
          .from("cohort_members")
          .select("cohort_id, user_id, joined_at")
          .in("cohort_id", cohortIds)
          .is("left_at", null)
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, full_name, preferred_name, avatar_url"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    beginnersCourseId
      ? supabase
          .from("course_enrollments")
          .select("user_id, cohort_id, delivery_mode")
          .eq("course_id", beginnersCourseId)
      : Promise.resolve({ data: [] }),
    groupPackageId
      ? supabase
          .from("student_packages")
          .select("user_id, status, purchased_at")
          .eq("package_id", groupPackageId)
          .neq("status", "cancelled")
      : Promise.resolve({ data: [] }),
    supabase.from("packages").select("id").eq("slug", "beginners-1-1").maybeSingle(),
  ]);

  const { data: oneToOnePackages } = oneToOnePackageRow?.id
    ? await supabase
        .from("student_packages")
        .select("user_id")
        .eq("package_id", oneToOnePackageRow.id)
        .neq("status", "cancelled")
    : { data: [] };

  const emailById = new Map(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? null] as const)
  );
  const labelById = new Map(
    (profileRows ?? []).map((p) => [
      p.id,
      getDisplayName(p) ?? emailById.get(p.id) ?? p.id.slice(0, 8),
    ] as const)
  );

  const packageStatusByUser = new Map(
    (groupPackages ?? []).map((row) => [row.user_id, row.status] as const)
  );

  const enrollmentByUser = new Map(
    (enrollmentRows ?? []).map((row) => [
      row.user_id,
      { cohortId: row.cohort_id, deliveryMode: row.delivery_mode },
    ] as const)
  );

  const allocatedUserIds = new Set((memberRows ?? []).map((m) => m.user_id));

  const membersByCohort = new Map<string, CohortMemberOverview[]>();
  for (const member of memberRows ?? []) {
    const enrollment = enrollmentByUser.get(member.user_id);
    const list = membersByCohort.get(member.cohort_id) ?? [];
    list.push({
      userId: member.user_id,
      label: labelById.get(member.user_id) ?? "Member",
      email: emailById.get(member.user_id) ?? null,
      joinedAt: member.joined_at,
      packageStatus: packageStatusByUser.get(member.user_id) ?? null,
      hasEnrollment: Boolean(enrollment?.cohortId === member.cohort_id),
      enrollmentDeliveryMode: enrollment?.deliveryMode ?? null,
    });
    membersByCohort.set(member.cohort_id, list);
  }

  const cohorts: CohortOverview[] = (cohortRows ?? []).map((row) => {
    const course = courseById.get(row.course_id);
    const members = membersByCohort.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      courseName: course?.name ?? "Course",
      tutorLabel: row.tutor_id ? labelById.get(row.tutor_id) ?? null : null,
      active: row.active,
      createdAt: row.created_at,
      memberCount: members.length,
      members: members.sort((a, b) => a.label.localeCompare(b.label)),
    };
  });

  const unallocatedGroupBuyers: UnallocatedGroupBuyer[] = (groupPackages ?? [])
    .filter((pkg) => !allocatedUserIds.has(pkg.user_id))
    .map((pkg) => ({
      userId: pkg.user_id,
      label: labelById.get(pkg.user_id) ?? "Student",
      email: emailById.get(pkg.user_id) ?? null,
      packageStatus: pkg.status,
      purchasedAt: pkg.purchased_at,
    }))
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));

  const totalAllocated = allocatedUserIds.size;
  const activeCohorts = cohorts.filter((c) => c.active).length;

  return {
    data: {
      cohorts,
      unallocatedGroupBuyers,
      stats: {
        activeCohorts,
        totalAllocated,
        unallocatedGroup: unallocatedGroupBuyers.length,
        oneToOneBeginners: (oneToOnePackages ?? []).length,
      },
    },
  };
}
