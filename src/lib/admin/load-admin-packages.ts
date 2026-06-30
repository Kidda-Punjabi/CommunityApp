import type {
  AdminPackageDetail,
  AdminPackageKind,
  AdminPackageListRow,
  OnboardingChecklistRow,
  PackageLessonLogEntry,
  PackagesRosterMember,
} from "@/lib/admin/packages/types";
import type { PackageInstanceStatus, PackageMembershipStatus } from "@/lib/admin/package-status";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRow = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
};

function labelForProfile(profile: ProfileRow | undefined, email: string | null): string {
  if (!profile) return email ?? "Unknown";
  return getDisplayName(profile) ?? email ?? profile.id.slice(0, 8);
}

function rosterFromPackages(
  rows: Array<{
    id: string;
    user_id: string;
    status: PackageMembershipStatus;
  }>,
  profileById: Map<string, ProfileRow>,
  emailById: Map<string, string | null>
): { interested: PackagesRosterMember[]; confirmed: PackagesRosterMember[] } {
  const interested: PackagesRosterMember[] = [];
  const confirmed: PackagesRosterMember[] = [];

  for (const row of rows) {
    const member: PackagesRosterMember = {
      userId: row.user_id,
      studentPackageId: row.id,
      membershipStatus: row.status,
      label: labelForProfile(profileById.get(row.user_id), emailById.get(row.user_id) ?? null),
      email: emailById.get(row.user_id) ?? null,
      avatarUrl: profileById.get(row.user_id)?.avatar_url ?? null,
    };

    if (row.status === "confirmed") {
      confirmed.push(member);
    } else if (row.status === "interested" || row.status === "waiting_for_payment") {
      interested.push(member);
    }
  }

  const byLabel = (a: PackagesRosterMember, b: PackagesRosterMember) =>
    a.label.localeCompare(b.label);

  return {
    interested: interested.sort(byLabel),
    confirmed: confirmed.sort(byLabel),
  };
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

export async function loadAdminPackagesList(
  supabase: SupabaseClient
): Promise<{ rows: AdminPackageListRow[]; error?: string }> {
  const [
    { data: cohortRows, error: cohortsError },
    { data: instanceRows, error: instancesError },
    { data: courses },
    { data: profiles },
    { data: packages },
  ] = await Promise.all([
    supabase
      .from("cohorts")
      .select(
        "id, name, course_id, tutor_id, status, start_day_of_week, start_date, end_date, capacity, active"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("package_instances")
      .select(
        "id, name, package_id, course_id, tutor_id, status, start_day_of_week, start_date, end_date, capacity, active"
      )
      .order("created_at", { ascending: false }),
    supabase.from("courses").select("id, name"),
    supabase.from("profiles").select("id, full_name, preferred_name, avatar_url"),
    supabase.from("packages").select("id, name, delivery_mode, course_id"),
  ]);

  if (cohortsError) return { rows: [], error: cohortsError.message };
  if (instancesError) return { rows: [], error: instancesError.message };

  const courseById = new Map((courses ?? []).map((c) => [c.id, c.name] as const));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow] as const));
  const packageById = new Map((packages ?? []).map((p) => [p.id, p] as const));

  const cohortIds = (cohortRows ?? []).map((c) => c.id);
  const instanceIds = (instanceRows ?? []).map((i) => i.id);

  const [{ data: cohortEnrollments }, { data: instancePackages }, { data: cohortUnlocks }] =
    await Promise.all([
    cohortIds.length > 0
      ? supabase
          .from("course_enrollments")
          .select("user_id, cohort_id, student_package_id, id")
          .in("cohort_id", cohortIds)
      : Promise.resolve({ data: [] }),
    instanceIds.length > 0
      ? supabase
          .from("student_packages")
          .select("id, user_id, status, package_instance_id")
          .in("package_instance_id", instanceIds)
      : Promise.resolve({ data: [] }),
    cohortIds.length > 0
      ? supabase
          .from("cohort_lesson_unlocks")
          .select("cohort_id, unlocked_at")
          .in("cohort_id", cohortIds)
      : Promise.resolve({ data: [] }),
  ]);

  const enrollmentPackageIds = [
    ...new Set(
      (cohortEnrollments ?? [])
        .map((e) => e.student_package_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const enrollmentIds = (cohortEnrollments ?? []).map((e) => e.id);

  const { data: packagesByEnrollment } =
    enrollmentIds.length > 0
      ? await supabase
          .from("student_packages")
          .select("id, user_id, status, enrollment_id")
          .in("enrollment_id", enrollmentIds)
      : { data: [] };

  const { data: packagesByEnrollmentIdFromSp } =
    enrollmentPackageIds.length > 0
      ? await supabase
          .from("student_packages")
          .select("id, user_id, status, enrollment_id")
          .in("id", enrollmentPackageIds)
      : { data: [] };

  type StudentPackageRow = {
    id: string;
    user_id: string;
    status: PackageMembershipStatus;
    enrollment_id: string | null;
  };

  const studentPackagesByEnrollmentId = new Map<string, StudentPackageRow>();
  for (const sp of packagesByEnrollment ?? []) {
    if (sp.enrollment_id) {
      studentPackagesByEnrollmentId.set(sp.enrollment_id, {
        id: sp.id,
        user_id: sp.user_id,
        status: sp.status as PackageMembershipStatus,
        enrollment_id: sp.enrollment_id,
      });
    }
  }
  for (const sp of packagesByEnrollmentIdFromSp ?? []) {
    if (sp.enrollment_id) {
      studentPackagesByEnrollmentId.set(sp.enrollment_id, {
        id: sp.id,
        user_id: sp.user_id,
        status: sp.status as PackageMembershipStatus,
        enrollment_id: sp.enrollment_id,
      });
    }
  }

  const packagesByCohortId = new Map<
    string,
    Array<{ id: string; user_id: string; status: PackageMembershipStatus }>
  >();
  for (const enrollment of cohortEnrollments ?? []) {
    if (!enrollment.cohort_id) continue;
    const sp =
      (enrollment.student_package_id
        ? (packagesByEnrollmentIdFromSp ?? []).find((row) => row.id === enrollment.student_package_id)
        : undefined) ?? studentPackagesByEnrollmentId.get(enrollment.id);
    if (!sp) continue;
    const list = packagesByCohortId.get(enrollment.cohort_id) ?? [];
    list.push({
      id: sp.id,
      user_id: sp.user_id,
      status: sp.status,
    });
    packagesByCohortId.set(enrollment.cohort_id, list);
  }

  const packagesByInstanceId = new Map<
    string,
    Array<{ id: string; user_id: string; status: PackageMembershipStatus }>
  >();
  for (const sp of instancePackages ?? []) {
    if (!sp.package_instance_id) continue;
    const list = packagesByInstanceId.get(sp.package_instance_id) ?? [];
    list.push({
      id: sp.id,
      user_id: sp.user_id,
      status: sp.status as PackageMembershipStatus,
    });
    packagesByInstanceId.set(sp.package_instance_id, list);
  }

  const unlockStatsByCohort = new Map<string, { count: number; lastAt: string | null }>();
  for (const unlock of cohortUnlocks ?? []) {
    const current = unlockStatsByCohort.get(unlock.cohort_id) ?? { count: 0, lastAt: null };
    current.count += 1;
    if (!current.lastAt || unlock.unlocked_at > current.lastAt) {
      current.lastAt = unlock.unlocked_at;
    }
    unlockStatsByCohort.set(unlock.cohort_id, current);
  }

  const allUserIds = [
    ...new Set([
      ...(cohortEnrollments ?? []).map((e) => e.user_id),
      ...(instancePackages ?? []).map((sp) => sp.user_id),
    ]),
  ];
  const emailById = await loadEmails(supabase, allUserIds);

  const rows: AdminPackageListRow[] = [];

  for (const cohort of cohortRows ?? []) {
    const spRows = packagesByCohortId.get(cohort.id) ?? [];
    const roster = rosterFromPackages(spRows, profileById, emailById);
    const unlockStats = unlockStatsByCohort.get(cohort.id) ?? { count: 0, lastAt: null };
    const groupPkg = [...packageById.values()].find(
      (p) => p.course_id === cohort.course_id && p.delivery_mode === "group"
    );

    rows.push({
      kind: "cohort",
      id: cohort.id,
      name: cohort.name,
      courseId: cohort.course_id,
      courseName: courseById.get(cohort.course_id) ?? "Course",
      packageId: groupPkg?.id ?? null,
      tutorId: cohort.tutor_id,
      tutorName: cohort.tutor_id ? labelForProfile(profileById.get(cohort.tutor_id), null) : null,
      status: cohort.status as PackageInstanceStatus,
      startDayOfWeek: cohort.start_day_of_week,
      startDate: cohort.start_date,
      endDate: cohort.end_date,
      capacity: cohort.capacity,
      deliveryMode: "group",
      active: cohort.active,
      ...roster,
      lessonUnlockCount: unlockStats.count,
      lastLessonLoggedAt: unlockStats.lastAt,
    });
  }

  for (const instance of instanceRows ?? []) {
    const pkg = packageById.get(instance.package_id);
    const spRows = packagesByInstanceId.get(instance.id) ?? [];
    const roster = rosterFromPackages(spRows, profileById, emailById);

    rows.push({
      kind: "package_instance",
      id: instance.id,
      name: instance.name,
      courseId: instance.course_id,
      courseName: courseById.get(instance.course_id) ?? "Course",
      packageId: instance.package_id,
      tutorId: instance.tutor_id,
      tutorName: instance.tutor_id
        ? labelForProfile(profileById.get(instance.tutor_id), null)
        : null,
      status: instance.status as PackageInstanceStatus,
      startDayOfWeek: instance.start_day_of_week,
      startDate: instance.start_date,
      endDate: instance.end_date,
      capacity: instance.capacity,
      deliveryMode:
        pkg?.delivery_mode === "one_to_one"
          ? "one_to_one"
          : pkg?.delivery_mode === "group"
            ? "group"
            : "one_to_one",
      active: instance.active,
      ...roster,
      lessonUnlockCount: 0,
      lastLessonLoggedAt: null,
    });
  }

  return { rows };
}

export async function loadAdminPackageDetail(
  supabase: SupabaseClient,
  kind: AdminPackageKind,
  id: string
): Promise<{ detail: AdminPackageDetail | null; error?: string }> {
  const list = await loadAdminPackagesList(supabase);
  if (list.error) return { detail: null, error: list.error };

  const base = list.rows.find((row) => row.kind === kind && row.id === id);
  if (!base) return { detail: null, error: "Package not found." };

  let active = true;
  let packageId: string | null = null;
  let packageName: string | null = null;

  if (kind === "cohort") {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("active, course_id")
      .eq("id", id)
      .maybeSingle();
    active = cohort?.active ?? true;

    const { data: groupPkg } = await supabase
      .from("packages")
      .select("id, name")
      .eq("course_id", cohort?.course_id ?? base.courseId)
      .eq("delivery_mode", "group")
      .maybeSingle();
    packageId = groupPkg?.id ?? null;
    packageName = groupPkg?.name ?? null;
  } else {
    const { data: instance } = await supabase
      .from("package_instances")
      .select("active, package_id, packages(name)")
      .eq("id", id)
      .maybeSingle();
    active = instance?.active ?? true;
    packageId = instance?.package_id ?? null;
    const pkg = Array.isArray(instance?.packages) ? instance.packages[0] : instance?.packages;
    packageName = pkg?.name ?? null;
  }

  const lessonLog = await loadLessonLog(supabase, kind, id, base.courseId);

  return {
    detail: {
      ...base,
      active,
      packageId,
      packageName,
      lessonLog,
    },
  };
}

async function loadLessonLog(
  supabase: SupabaseClient,
  kind: AdminPackageKind,
  id: string,
  courseId: string
): Promise<PackageLessonLogEntry[]> {
  if (kind === "cohort") {
    const { data: unlocks } = await supabase
      .from("cohort_lesson_unlocks")
      .select("lesson_id, unlocked_at, lessons(lesson_number, title)")
      .eq("cohort_id", id)
      .order("unlocked_at", { ascending: false });

    return (unlocks ?? []).map((row) => {
      const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
      return {
        lessonId: row.lesson_id,
        lessonNumber: lesson?.lesson_number ?? 0,
        lessonTitle: lesson?.title ?? "Lesson",
        unlockedAt: row.unlocked_at,
      };
    });
  }

  const { data: instanceStudents } = await supabase
    .from("student_packages")
    .select("user_id")
    .eq("package_instance_id", id);

  const studentIds = (instanceStudents ?? []).map((s) => s.user_id);
  if (studentIds.length === 0) return [];

  const { data: unlocks } = await supabase
    .from("student_lesson_unlocks")
    .select("lesson_id, unlocked_at, student_id, lessons(lesson_number, title, course_id)")
    .in("student_id", studentIds)
    .order("unlocked_at", { ascending: false });

  const seen = new Set<string>();
  const entries: PackageLessonLogEntry[] = [];

  for (const row of unlocks ?? []) {
    const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
    if (lesson?.course_id !== courseId) continue;
    if (seen.has(row.lesson_id)) continue;
    seen.add(row.lesson_id);
    entries.push({
      lessonId: row.lesson_id,
      lessonNumber: lesson.lesson_number ?? 0,
      lessonTitle: lesson.title ?? "Lesson",
      unlockedAt: row.unlocked_at,
    });
  }

  return entries;
}

export async function loadOnboardingChecklist(
  supabase: SupabaseClient,
  studentPackageId: string
): Promise<{ checklist: OnboardingChecklistRow | null; error?: string }> {
  const { data, error } = await supabase
    .from("onboarding_checklists")
    .select("*")
    .eq("student_package_id", studentPackageId)
    .maybeSingle();

  if (error) return { checklist: null, error: error.message };
  if (!data) return { checklist: null };

  return {
    checklist: {
      id: data.id,
      checklistType: data.checklist_type,
      timeAssigned: data.time_assigned,
      welcomeEmail: data.welcome_email,
      calendarInvite: data.calendar_invite,
      tutorNotified: data.tutor_notified,
      packageCreated: data.package_created,
      whatsappChatMade: data.whatsapp_chat_made,
      scheduleWhatsappChat: data.schedule_whatsapp_chat,
      onboardingCompleted: data.onboarding_completed,
      paymentDate: data.payment_date,
      notes: data.notes,
    },
  };
}
