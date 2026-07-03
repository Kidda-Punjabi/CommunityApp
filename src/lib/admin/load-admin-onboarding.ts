import { COMMUNITY_PACKAGE_SLUG } from "@/lib/admin/community-package";
import {
  ONBOARDING_CHECKLIST_PROGRESS_KEYS,
  type AdminOnboardingCompletedRow,
  type AdminOnboardingRow,
  type AdminOnboardingSummary,
  type OnboardingQueue,
} from "@/lib/admin/onboarding/types";
import type { PackageInstanceStatus, PackageMembershipStatus } from "@/lib/admin/package-status";
import type { OnboardingChecklistRow } from "@/lib/admin/packages/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

const OFFBOARDING_RUN_STATUSES: PackageInstanceStatus[] = [
  "classes_completed",
  "incomplete",
  "postponed",
  "offboarding_complete",
];

type ProfileRow = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
};

type StudentPackageRow = {
  id: string;
  user_id: string;
  status: string;
  package_id: string;
  course_id: string;
  enrollment_id: string | null;
  package_instance_id: string | null;
  purchased_at: string;
  packages: unknown;
  courses: unknown;
};

function labelForProfile(profile: ProfileRow | undefined, email: string | null): string {
  if (!profile) return email ?? "Unknown";
  return getDisplayName(profile) ?? email ?? profile.id.slice(0, 8);
}

function mapChecklist(row: Record<string, unknown> | null): OnboardingChecklistRow | null {
  if (!row) return null;
  return {
    id: row.id as string,
    checklistType: row.checklist_type as "group" | "one_to_one",
    timeAssigned: Boolean(row.time_assigned),
    welcomeEmail: Boolean(row.welcome_email),
    calendarInvite: Boolean(row.calendar_invite),
    tutorNotified: Boolean(row.tutor_notified),
    packageCreated: Boolean(row.package_created),
    whatsappChatMade: Boolean(row.whatsapp_chat_made),
    scheduleWhatsappChat: Boolean(row.schedule_whatsapp_chat),
    onboardingCompleted: Boolean(row.onboarding_completed),
    paymentDate: (row.payment_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

function checklistUpdatedAt(row: Record<string, unknown> | null): string | null {
  if (!row || !row.onboarding_completed) return null;
  return (row.updated_at as string | null) ?? null;
}

function checklistProgress(checklist: OnboardingChecklistRow | null): {
  done: number;
  total: number;
} {
  const total = ONBOARDING_CHECKLIST_PROGRESS_KEYS.length;
  if (!checklist) return { done: 0, total };
  const done = ONBOARDING_CHECKLIST_PROGRESS_KEYS.filter((key) => checklist[key]).length;
  return { done, total };
}

const ONBOARDING_STALL_DAYS = 7;

function isOverdue(params: {
  checklist: OnboardingChecklistRow | null;
  membershipStatus: PackageMembershipStatus;
  packageRunId: string | null;
  purchasedAt: string;
  progressDone: number;
  progressTotal: number;
}): boolean {
  const { checklist, membershipStatus, packageRunId, purchasedAt, progressDone, progressTotal } =
    params;

  if (checklist?.onboardingCompleted) return false;
  if (membershipStatus === "withdrawn") return false;
  if (membershipStatus !== "confirmed" && membershipStatus !== "waiting_for_payment") {
    return false;
  }

  const referenceDate = checklist?.paymentDate ?? purchasedAt?.slice(0, 10);
  if (!referenceDate) return false;

  const stallAfter = new Date(`${referenceDate}T12:00:00`);
  stallAfter.setDate(stallAfter.getDate() + ONBOARDING_STALL_DAYS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (stallAfter >= today) return false;

  const setupIncomplete = progressDone < progressTotal;
  const packageUnassigned = !packageRunId;

  return setupIncomplete || packageUnassigned;
}

function classifyQueue(
  membershipStatus: PackageMembershipStatus,
  runStatus: PackageInstanceStatus | null,
  checklist: OnboardingChecklistRow | null
): OnboardingQueue | null {
  if (
    membershipStatus === "confirmed" &&
    runStatus &&
    OFFBOARDING_RUN_STATUSES.includes(runStatus)
  ) {
    return "offboarding";
  }

  if (
    membershipStatus !== "withdrawn" &&
    !checklist?.onboardingCompleted &&
    (membershipStatus === "interested" ||
      membershipStatus === "waiting_for_payment" ||
      membershipStatus === "confirmed")
  ) {
    return "onboarding";
  }

  return null;
}

function isCompletedOnboarding(
  membershipStatus: PackageMembershipStatus,
  checklist: OnboardingChecklistRow | null
): boolean {
  return membershipStatus !== "withdrawn" && checklist?.onboardingCompleted === true;
}

async function loadEmails(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const emailById = new Map<string, string | null>();
  if (userIds.length === 0) return emailById;

  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (userIds.includes(user.id)) {
      emailById.set(user.id, user.email ?? null);
    }
  }
  return emailById;
}

type ResolvedRun = {
  packageRunId: string | null;
  packageRunKind: "cohort" | "package_instance" | null;
  packageRunName: string | null;
  packageRunHref: string | null;
  packageRunStatus: PackageInstanceStatus | null;
  tutorName: string | null;
  checklistType: "group" | "one_to_one";
  deliveryMode: "group" | "one_to_one";
};

function resolveRunForStudentPackage(
  sp: StudentPackageRow,
  pkg: { name: string; slug: string; delivery_mode: string | null },
  enrollmentById: Map<string, Record<string, unknown>>,
  instanceById: Map<string, Record<string, unknown>>,
  tutorNameById: Map<string, string>
): ResolvedRun {
  let packageRunId: string | null = null;
  let packageRunKind: "cohort" | "package_instance" | null = null;
  let packageRunName: string | null = null;
  let packageRunHref: string | null = null;
  let packageRunStatus: PackageInstanceStatus | null = null;
  let tutorName: string | null = null;
  let checklistType: "group" | "one_to_one" =
    pkg.delivery_mode === "group" ? "group" : "one_to_one";
  const deliveryMode: "group" | "one_to_one" =
    pkg.delivery_mode === "group" ? "group" : "one_to_one";

  if (sp.enrollment_id) {
    const enrollment = enrollmentById.get(sp.enrollment_id);
    const cohortRaw = Array.isArray(enrollment?.cohorts)
      ? enrollment.cohorts[0]
      : enrollment?.cohorts;
    if (cohortRaw && typeof cohortRaw === "object" && "id" in cohortRaw) {
      const cohort = cohortRaw as { id: string; name?: string; status?: string };
      packageRunId = cohort.id;
      packageRunKind = "cohort";
      packageRunName = cohort.name ?? "Cohort";
      packageRunHref = `/admin/packages/${cohort.id}`;
      packageRunStatus = cohort.status as PackageInstanceStatus;
      checklistType = "group";
    }
    const tutorId = enrollment?.tutor_id as string | undefined;
    if (tutorId) tutorName = tutorNameById.get(tutorId) ?? null;
  }

  if (sp.package_instance_id) {
    const instance = instanceById.get(sp.package_instance_id);
    if (instance) {
      packageRunId = instance.id as string;
      packageRunKind = "package_instance";
      packageRunName = instance.name as string;
      packageRunHref = `/admin/packages/${instance.id as string}`;
      packageRunStatus = instance.status as PackageInstanceStatus;
      checklistType = "one_to_one";
    }
    const tutorId = instance?.tutor_id as string | undefined;
    if (tutorId) tutorName = tutorNameById.get(tutorId) ?? null;
  }

  return {
    packageRunId,
    packageRunKind,
    packageRunName,
    packageRunHref,
    packageRunStatus,
    tutorName,
    checklistType,
    deliveryMode,
  };
}

export async function loadAdminOnboardingQueue(
  supabase: SupabaseClient
): Promise<{
  rows: AdminOnboardingRow[];
  completedRows: AdminOnboardingCompletedRow[];
  summary: AdminOnboardingSummary;
  error?: string;
}> {
  const emptySummary: AdminOnboardingSummary = {
    onboardingCount: 0,
    offboardingCount: 0,
    overdueCount: 0,
    completedCount: 0,
  };

  const [
    { data: studentPackages, error: spError },
    { data: profiles },
    { data: checklists },
  ] = await Promise.all([
    supabase
      .from("student_packages")
      .select(
        "id, user_id, status, package_id, course_id, enrollment_id, package_instance_id, purchased_at, packages(name, slug, delivery_mode, includes_live_sessions), courses(name)"
      )
      .in("status", ["interested", "waiting_for_payment", "confirmed", "withdrawn"]),
    supabase.from("profiles").select("id, full_name, preferred_name"),
    supabase.from("onboarding_checklists").select("*"),
  ]);

  if (spError) {
    return { rows: [], completedRows: [], summary: emptySummary, error: spError.message };
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow] as const));
  const checklistRawByStudentPackageId = new Map(
    (checklists ?? []).map((row) => [row.student_package_id as string, row] as const)
  );
  const checklistByStudentPackageId = new Map(
    [...checklistRawByStudentPackageId.entries()].map(
      ([id, row]) => [id, mapChecklist(row)] as const
    )
  );

  const liveSessionRows = (studentPackages ?? []).filter((row) => {
    const pkg = Array.isArray(row.packages) ? row.packages[0] : row.packages;
    if (!pkg) return false;
    if (pkg.slug === COMMUNITY_PACKAGE_SLUG) return false;
    return pkg.includes_live_sessions === true;
  }) as StudentPackageRow[];

  const enrollmentIds = [
    ...new Set(
      liveSessionRows.map((row) => row.enrollment_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const instanceIds = [
    ...new Set(
      liveSessionRows
        .map((row) => row.package_instance_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: enrollments }, { data: instances }] = await Promise.all([
    enrollmentIds.length > 0
      ? supabase
          .from("course_enrollments")
          .select("id, cohort_id, tutor_id, cohorts(id, name, status)")
          .in("id", enrollmentIds)
      : Promise.resolve({ data: [] }),
    instanceIds.length > 0
      ? supabase
          .from("package_instances")
          .select("id, name, status, tutor_id")
          .in("id", instanceIds)
      : Promise.resolve({ data: [] }),
  ]);

  const enrollmentById = new Map(
    (enrollments ?? []).map((row) => [row.id, row as Record<string, unknown>] as const)
  );
  const instanceById = new Map(
    (instances ?? []).map((row) => [row.id, row as Record<string, unknown>] as const)
  );

  const tutorIds = [
    ...new Set([
      ...(enrollments ?? []).map((row) => row.tutor_id).filter(Boolean),
      ...(instances ?? []).map((row) => row.tutor_id).filter(Boolean),
    ]),
  ] as string[];

  const { data: tutorProfiles } =
    tutorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", tutorIds)
      : { data: [] };

  const tutorNameById = new Map(
    (tutorProfiles ?? []).map(
      (row) => [row.id, getDisplayName(row) ?? row.id.slice(0, 8)] as const
    )
  );

  const userIds = [...new Set(liveSessionRows.map((row) => row.user_id))];
  const emailById = await loadEmails(supabase, userIds);

  const rows: AdminOnboardingRow[] = [];
  const completedRows: AdminOnboardingCompletedRow[] = [];

  for (const sp of liveSessionRows) {
    const pkg = Array.isArray(sp.packages) ? sp.packages[0] : sp.packages;
    if (!pkg) continue;

    const checklist = checklistByStudentPackageId.get(sp.id) ?? null;
    const checklistRaw = checklistRawByStudentPackageId.get(sp.id) ?? null;
    const membershipStatus = sp.status as PackageMembershipStatus;
    const run = resolveRunForStudentPackage(
      sp,
      pkg as { name: string; slug: string; delivery_mode: string | null },
      enrollmentById,
      instanceById,
      tutorNameById
    );

    const course = Array.isArray(sp.courses) ? sp.courses[0] : sp.courses;
    const courseName = (course as { name?: string } | null)?.name ?? pkg.name;
    const studentLabel = labelForProfile(
      profileById.get(sp.user_id),
      emailById.get(sp.user_id) ?? null
    );
    const email = emailById.get(sp.user_id) ?? null;
    const paymentDate = checklist?.paymentDate ?? null;

    if (isCompletedOnboarding(membershipStatus, checklist)) {
      completedRows.push({
        studentPackageId: sp.id,
        studentLabel,
        email,
        courseName,
        packageRunName: run.packageRunName,
        packageRunHref: run.packageRunHref,
        packageRunStatus: run.packageRunStatus,
        tutorName: run.tutorName,
        membershipStatus,
        paymentDate,
        completedAt: checklistUpdatedAt(checklistRaw),
        checklistType: run.checklistType,
        checklist,
      });
    }

    const queue = classifyQueue(membershipStatus, run.packageRunStatus, checklist);
    if (!queue) continue;

    const { done, total } = checklistProgress(checklist);
    const overdue =
      queue === "onboarding" &&
      isOverdue({
        checklist,
        membershipStatus,
        packageRunId: run.packageRunId,
        purchasedAt: sp.purchased_at,
        progressDone: done,
        progressTotal: total,
      });

    rows.push({
      studentPackageId: sp.id,
      userId: sp.user_id,
      studentLabel,
      email,
      membershipStatus,
      courseId: sp.course_id,
      courseName,
      deliveryMode: run.deliveryMode,
      packageRunId: run.packageRunId,
      packageRunKind: run.packageRunKind,
      packageRunName: run.packageRunName,
      packageRunHref: run.packageRunHref,
      packageRunStatus: run.packageRunStatus,
      tutorName: run.tutorName,
      checklistType: run.checklistType,
      checklist,
      progressDone: done,
      progressTotal: total,
      isOverdue: overdue,
      queue,
      paymentDate,
      purchasedAt: sp.purchased_at,
    });
  }

  rows.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.queue !== b.queue) return a.queue === "onboarding" ? -1 : 1;
    return a.studentLabel.localeCompare(b.studentLabel);
  });

  completedRows.sort((a, b) => {
    const aDate = a.completedAt ?? "";
    const bDate = b.completedAt ?? "";
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return a.studentLabel.localeCompare(b.studentLabel);
  });

  const summary: AdminOnboardingSummary = {
    onboardingCount: rows.filter((row) => row.queue === "onboarding").length,
    offboardingCount: rows.filter((row) => row.queue === "offboarding").length,
    overdueCount: rows.filter((row) => row.isOverdue).length,
    completedCount: completedRows.length,
  };

  return { rows, completedRows, summary };
}
