import {
  cohortIdFromInboxRow,
} from "@/lib/notion/notion-cohort-link";
import type {
  AdminPackageDetail,
  AdminPackageKind,
  AdminPackageListRow,
  CohortCalendarLinkState,
  OnboardingChecklistRow,
  PackageLessonLogEntry,
  PackagesRosterMember,
} from "@/lib/admin/packages/types";
import type { PackageInstanceStatus, PackageMembershipStatus } from "@/lib/admin/package-status";
import { fetchCommunityPackageProduct } from "@/lib/admin/community-package";
import { getDisplayName } from "@/lib/profile/display-name";
import type { TutorIdSource } from "@/lib/notion/tutor-id-source";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Statuses that should flag missing calendar link / tutor setup. */
export const CALENDAR_ATTENTION_STATUSES: PackageInstanceStatus[] = [
  "pre_scheduling",
  "recruiting",
  "scheduled",
  "in_progress",
  "paused",
];

type ProfileRow = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
};

function resolveTutorIdSource(value: string | null | undefined): TutorIdSource {
  return value === "manual" ? "manual" : "notion";
}

function resolveCohortCalendarState(params: {
  tutorId: string | null;
  hasConnection: boolean;
  hasRecurringEvent: boolean;
}): CohortCalendarLinkState {
  if (!params.tutorId) return "no_tutor";
  if (params.hasRecurringEvent) return "linked";
  if (!params.hasConnection) return "no_connection";
  return "unlinked";
}

function calendarNeedsAttention(
  status: PackageInstanceStatus,
  state: CohortCalendarLinkState
): boolean {
  if (!CALENDAR_ATTENTION_STATUSES.includes(status)) return false;
  return state === "unlinked" || state === "no_tutor" || state === "no_connection";
}

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
): {
  interested: PackagesRosterMember[];
  waitingForPayment: PackagesRosterMember[];
  confirmed: PackagesRosterMember[];
} {
  const interested: PackagesRosterMember[] = [];
  const waitingForPayment: PackagesRosterMember[] = [];
  const confirmed: PackagesRosterMember[] = [];

  for (const row of rows) {
    const member: PackagesRosterMember = {
      userId: row.user_id,
      studentPackageId: row.id,
      membershipStatus: row.status,
      label: labelForProfile(profileById.get(row.user_id), emailById.get(row.user_id) ?? null),
      email: emailById.get(row.user_id) ?? null,
      avatarUrl: profileById.get(row.user_id)?.avatar_url ?? null,
      isNotionLead: false,
    };

    if (row.status === "confirmed") {
      confirmed.push(member);
    } else if (row.status === "waiting_for_payment") {
      waitingForPayment.push(member);
    } else if (row.status === "interested") {
      interested.push(member);
    }
  }

  const byLabel = (a: PackagesRosterMember, b: PackagesRosterMember) =>
    a.label.localeCompare(b.label);

  return {
    interested: interested.sort(byLabel),
    waitingForPayment: waitingForPayment.sort(byLabel),
    confirmed: confirmed.sort(byLabel),
  };
}

function mergeRosterSources(
  fromPackages: {
    interested: PackagesRosterMember[];
    waitingForPayment: PackagesRosterMember[];
    confirmed: PackagesRosterMember[];
  },
  fromNotion: {
    interested: PackagesRosterMember[];
    waitingForPayment: PackagesRosterMember[];
    confirmed: PackagesRosterMember[];
  } | null
): {
  interested: PackagesRosterMember[];
  waitingForPayment: PackagesRosterMember[];
  confirmed: PackagesRosterMember[];
} {
  if (!fromNotion) return fromPackages;

  const byLabel = (a: PackagesRosterMember, b: PackagesRosterMember) =>
    a.label.localeCompare(b.label);

  const coveredUserIds = new Set<string>();
  const coveredStudentPackageIds = new Set<string>();

  for (const member of [
    ...fromPackages.interested,
    ...fromPackages.waitingForPayment,
    ...fromPackages.confirmed,
  ]) {
    if (member.userId) coveredUserIds.add(member.userId);
    if (
      !member.studentPackageId.startsWith("notion-roster:") &&
      !member.studentPackageId.startsWith("inbox-cache:")
    ) {
      coveredStudentPackageIds.add(member.studentPackageId);
    }
  }

  function mergeBucket(
    packagesBucket: PackagesRosterMember[],
    notionBucket: PackagesRosterMember[]
  ): PackagesRosterMember[] {
    const merged = [...packagesBucket];
    for (const member of notionBucket) {
      if (member.userId && coveredUserIds.has(member.userId)) continue;
      if (
        member.studentPackageId &&
        !member.studentPackageId.startsWith("notion-roster:") &&
        !member.studentPackageId.startsWith("inbox-cache:") &&
        coveredStudentPackageIds.has(member.studentPackageId)
      ) {
        continue;
      }
      merged.push(member);
      if (member.userId) coveredUserIds.add(member.userId);
    }
    return merged.sort(byLabel);
  }

  return {
    interested: mergeBucket(fromPackages.interested, fromNotion.interested),
    waitingForPayment: mergeBucket(
      fromPackages.waitingForPayment,
      fromNotion.waitingForPayment
    ),
    confirmed: mergeBucket(fromPackages.confirmed, fromNotion.confirmed),
  };
}

function rosterFromNotionMirror(
  rows: Array<{
    id: string;
    lead_name: string;
    lead_email: string | null;
    roster_status: PackageMembershipStatus;
    profile_id: string | null;
    notion_lead_page_id: string;
    student_package_id: string | null;
  }>,
  profileById: Map<string, ProfileRow>,
  emailById: Map<string, string | null>
): {
  interested: PackagesRosterMember[];
  waitingForPayment: PackagesRosterMember[];
  confirmed: PackagesRosterMember[];
} {
  const interested: PackagesRosterMember[] = [];
  const waitingForPayment: PackagesRosterMember[] = [];
  const confirmed: PackagesRosterMember[] = [];

  for (const row of rows) {
    const profile = row.profile_id ? profileById.get(row.profile_id) : undefined;
    const member: PackagesRosterMember = {
      userId: row.profile_id,
      notionLeadPageId: row.notion_lead_page_id,
      isNotionLead: true,
      studentPackageId: row.student_package_id ?? `notion-roster:${row.id}`,
      membershipStatus: row.roster_status,
      label: profile
        ? labelForProfile(profile, row.lead_email ?? emailById.get(row.profile_id!) ?? null)
        : row.lead_name,
      email: row.lead_email ?? (row.profile_id ? emailById.get(row.profile_id) ?? null : null),
      avatarUrl: profile?.avatar_url ?? null,
    };

    if (row.roster_status === "confirmed") {
      confirmed.push(member);
    } else if (row.roster_status === "waiting_for_payment") {
      waitingForPayment.push(member);
    } else if (row.roster_status === "interested") {
      interested.push(member);
    }
  }

  const byLabel = (a: PackagesRosterMember, b: PackagesRosterMember) =>
    a.label.localeCompare(b.label);

  return {
    interested: interested.sort(byLabel),
    waitingForPayment: waitingForPayment.sort(byLabel),
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
        "id, name, course_id, tutor_id, tutor_id_source, status, start_day_of_week, start_date, end_date, capacity, active, weekly_session_start, weekly_session_end"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("package_instances")
      .select(
        "id, name, package_id, course_id, tutor_id, tutor_id_source, status, start_day_of_week, start_date, end_date, capacity, active, notion_page_id"
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
  const cohortTutorIds = [
    ...new Set(
      (cohortRows ?? []).map((c) => c.tutor_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const notionLinkedInstanceIds = (instanceRows ?? [])
    .filter((row) => row.notion_page_id)
    .map((row) => row.id);

  const [{ data: recurringSessions }, { data: calendarConnections }] = await Promise.all([
    cohortIds.length > 0
      ? supabase
          .from("tutor_scheduled_sessions")
          .select("cohort_id, google_recurring_event_id, title, starts_at, ends_at")
          .in("cohort_id", cohortIds)
          .not("google_recurring_event_id", "is", null)
          .order("starts_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    cohortTutorIds.length > 0
      ? supabase
          .from("tutor_google_calendar_connections")
          .select("tutor_id, last_synced_at")
          .in("tutor_id", cohortTutorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const linkedEventByCohortId = new Map<
    string,
    {
      title: string;
      startsAt: string;
      endsAt: string;
      recurringEventId: string;
    }
  >();
  for (const row of recurringSessions ?? []) {
    if (!row.cohort_id || !row.google_recurring_event_id) continue;
    if (linkedEventByCohortId.has(row.cohort_id)) continue;
    linkedEventByCohortId.set(row.cohort_id, {
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      recurringEventId: row.google_recurring_event_id,
    });
  }
  const connectionByTutorId = new Map(
    (calendarConnections ?? []).map((row) => [
      row.tutor_id,
      row.last_synced_at as string | null,
    ])
  );

  const { data: resolvedInboxRows } = await supabase
    .from("notion_sync_inbox")
    .select("notion_page_id, raw_properties, resolved_package_instance_id")
    .eq("resolved", true);

  const notionLinkedCohortIds = new Set<string>();
  const cohortIdByNotionPageId = new Map<string, string>();
  for (const row of resolvedInboxRows ?? []) {
    const cohortId = cohortIdFromInboxRow(row);
    if (cohortId) {
      notionLinkedCohortIds.add(cohortId);
      cohortIdByNotionPageId.set(row.notion_page_id, cohortId);
    }
  }

  const notionPageIds = [
    ...new Set([
      ...(instanceRows ?? [])
        .map((row) => row.notion_page_id)
        .filter((id): id is string => Boolean(id)),
      ...(resolvedInboxRows ?? []).map((row) => row.notion_page_id),
    ]),
  ];

  const rosterTargetCount = notionLinkedInstanceIds.length + notionLinkedCohortIds.size;
  const [{ data: cohortEnrollments }, { data: instancePackages }, { data: cohortUnlocks }, { data: notionRosterRows }, { data: notionInboxRows }] =
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
    rosterTargetCount > 0
      ? supabase
          .from("package_instance_notion_roster")
          .select(
            "id, package_instance_id, cohort_id, lead_name, lead_email, roster_status, profile_id, notion_lead_page_id, student_package_id"
          )
          .or(
            [
              notionLinkedInstanceIds.length > 0
                ? `package_instance_id.in.(${notionLinkedInstanceIds.join(",")})`
                : null,
              notionLinkedCohortIds.size > 0
                ? `cohort_id.in.(${[...notionLinkedCohortIds].join(",")})`
                : null,
            ]
              .filter(Boolean)
              .join(",")
          )
      : Promise.resolve({ data: [], error: null }),
    notionPageIds.length > 0
      ? Promise.resolve({ data: resolvedInboxRows ?? [] })
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

  const notionRosterByInstanceId = new Map<
    string,
    Array<{
      id: string;
      lead_name: string;
      lead_email: string | null;
      roster_status: PackageMembershipStatus;
      profile_id: string | null;
      notion_lead_page_id: string;
      student_package_id: string | null;
    }>
  >();
  const notionRosterByCohortId = new Map<
    string,
    Array<{
      id: string;
      lead_name: string;
      lead_email: string | null;
      roster_status: PackageMembershipStatus;
      profile_id: string | null;
      notion_lead_page_id: string;
      student_package_id: string | null;
    }>
  >();
  for (const row of notionRosterRows ?? []) {
    const entry = {
      id: row.id,
      lead_name: row.lead_name,
      lead_email: row.lead_email,
      roster_status: row.roster_status as PackageMembershipStatus,
      profile_id: row.profile_id,
      notion_lead_page_id: row.notion_lead_page_id,
      student_package_id: row.student_package_id,
    };
    if (row.package_instance_id) {
      const list = notionRosterByInstanceId.get(row.package_instance_id) ?? [];
      list.push(entry);
      notionRosterByInstanceId.set(row.package_instance_id, list);
    }
    if (row.cohort_id) {
      const list = notionRosterByCohortId.get(row.cohort_id) ?? [];
      list.push(entry);
      notionRosterByCohortId.set(row.cohort_id, list);
    }
  }

  const instanceIdByNotionPageId = new Map(
    (instanceRows ?? [])
      .filter((row) => row.notion_page_id)
      .map((row) => [row.notion_page_id!, row.id] as const)
  );
  const cohortIdByNotionPageIdFromInbox = cohortIdByNotionPageId;

  for (const inboxRow of notionInboxRows ?? []) {
    const instanceId =
      inboxRow.resolved_package_instance_id ??
      instanceIdByNotionPageId.get(inboxRow.notion_page_id);
    const cohortId =
      cohortIdFromInboxRow(inboxRow) ??
      cohortIdByNotionPageIdFromInbox.get(inboxRow.notion_page_id);

    const raw = (inboxRow.raw_properties ?? {}) as {
      _roster_cache?: Array<{
        notionLeadPageId: string;
        leadName: string;
        leadEmail: string | null;
        rosterStatus: PackageMembershipStatus;
        profileId: string | null;
        studentPackageId: string | null;
      }>;
    };
    const cached = raw._roster_cache ?? [];
    if (cached.length === 0) continue;

    const mapped = cached.map((entry, index) => ({
      id: `inbox-cache:${index}`,
      lead_name: entry.leadName,
      lead_email: entry.leadEmail,
      roster_status: entry.rosterStatus,
      profile_id: entry.profileId,
      notion_lead_page_id: entry.notionLeadPageId,
      student_package_id: entry.studentPackageId,
    }));

    if (instanceId && (notionRosterByInstanceId.get(instanceId) ?? []).length === 0) {
      notionRosterByInstanceId.set(
        instanceId,
        mapped.map((entry, index) => ({ ...entry, id: `inbox-cache:${instanceId}:${index}` }))
      );
    }
    if (cohortId && (notionRosterByCohortId.get(cohortId) ?? []).length === 0) {
      notionRosterByCohortId.set(
        cohortId,
        mapped.map((entry, index) => ({ ...entry, id: `inbox-cache:${cohortId}:${index}` }))
      );
    }
  }

  // Legacy 1-1 runs only: include confirmed students assigned via enrollment when
  // package_instance_id was not set. Skip Notion-linked instances — roster comes from Leads DB.
  const nonNotionInstanceIds = instanceIds.filter(
    (id) => !notionLinkedInstanceIds.includes(id)
  );
  if (nonNotionInstanceIds.length > 0) {
    const instanceById = new Map((instanceRows ?? []).map((row) => [row.id, row] as const));
    const instanceCourseIds = [
      ...new Set(
        (instanceRows ?? [])
          .filter((row) => !row.notion_page_id)
          .map((row) => row.course_id)
      ),
    ];

    const { data: enrollmentLinkedPackages } = await supabase
      .from("student_packages")
      .select("id, user_id, status, course_id, package_instance_id")
      .in("course_id", instanceCourseIds)
      .eq("status", "confirmed")
      .is("package_instance_id", null);

    const orphanUserIds = [...new Set((enrollmentLinkedPackages ?? []).map((row) => row.user_id))];
    const { data: enrollments } =
      orphanUserIds.length > 0
        ? await supabase
            .from("course_enrollments")
            .select("user_id, course_id, tutor_id, delivery_mode")
            .in("user_id", orphanUserIds)
            .in("course_id", instanceCourseIds)
        : { data: [] };

    const enrollmentByUserCourse = new Map(
      (enrollments ?? []).map((row) => [`${row.user_id}:${row.course_id}`, row] as const)
    );

    for (const sp of enrollmentLinkedPackages ?? []) {
      const enrollment = enrollmentByUserCourse.get(`${sp.user_id}:${sp.course_id}`);
      if (!enrollment || enrollment.delivery_mode === "group") continue;

      for (const instanceId of nonNotionInstanceIds) {
        const instance = instanceById.get(instanceId);
        if (!instance || instance.course_id !== sp.course_id) continue;
        if (instance.tutor_id && enrollment.tutor_id !== instance.tutor_id) continue;

        const list = packagesByInstanceId.get(instanceId) ?? [];
        if (list.some((row) => row.user_id === sp.user_id)) continue;
        list.push({
          id: sp.id,
          user_id: sp.user_id,
          status: sp.status as PackageMembershipStatus,
        });
        packagesByInstanceId.set(instanceId, list);
      }
    }
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
      ...(notionRosterRows ?? [])
        .map((row) => row.profile_id)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];
  const emailById = await loadEmails(supabase, allUserIds);

  const rows: AdminPackageListRow[] = [];

  for (const cohort of cohortRows ?? []) {
    const roster = notionLinkedCohortIds.has(cohort.id)
      ? mergeRosterSources(
          rosterFromPackages(
            packagesByCohortId.get(cohort.id) ?? [],
            profileById,
            emailById
          ),
          rosterFromNotionMirror(
            notionRosterByCohortId.get(cohort.id) ?? [],
            profileById,
            emailById
          )
        )
      : rosterFromPackages(packagesByCohortId.get(cohort.id) ?? [], profileById, emailById);
    const unlockStats = unlockStatsByCohort.get(cohort.id) ?? { count: 0, lastAt: null };
    const groupPkg = [...packageById.values()].find(
      (p) => p.course_id === cohort.course_id && p.delivery_mode === "group"
    );

    const calendarLinkState = resolveCohortCalendarState({
      tutorId: cohort.tutor_id,
      hasConnection: cohort.tutor_id ? connectionByTutorId.has(cohort.tutor_id) : false,
      hasRecurringEvent: linkedEventByCohortId.has(cohort.id),
    });
    const status = cohort.status as PackageInstanceStatus;
    const calendarLinkedEvent = linkedEventByCohortId.get(cohort.id) ?? null;

    rows.push({
      kind: "cohort",
      id: cohort.id,
      name: cohort.name,
      courseId: cohort.course_id,
      courseName: courseById.get(cohort.course_id) ?? "Course",
      packageId: groupPkg?.id ?? null,
      tutorId: cohort.tutor_id,
      tutorName: cohort.tutor_id ? labelForProfile(profileById.get(cohort.tutor_id), null) : null,
      tutorIdSource: resolveTutorIdSource(cohort.tutor_id_source),
      status,
      startDayOfWeek: cohort.start_day_of_week,
      startDate: cohort.start_date,
      endDate: cohort.end_date,
      capacity: cohort.capacity,
      deliveryMode: "group",
      active: cohort.active,
      ...roster,
      lessonUnlockCount: unlockStats.count,
      lastLessonLoggedAt: unlockStats.lastAt,
      weeklySessionStart: cohort.weekly_session_start ?? null,
      weeklySessionEnd: cohort.weekly_session_end ?? null,
      calendarLinkState,
      calendarNeedsAttention: calendarNeedsAttention(status, calendarLinkState),
      calendarLinkedEvent,
      tutorCalendarLastSyncedAt: cohort.tutor_id
        ? (connectionByTutorId.get(cohort.tutor_id) ?? null)
        : null,
    });
  }

  for (const instance of instanceRows ?? []) {
    const pkg = packageById.get(instance.package_id);
    const packagesRoster = rosterFromPackages(
      packagesByInstanceId.get(instance.id) ?? [],
      profileById,
      emailById
    );
    const roster = instance.notion_page_id
      ? mergeRosterSources(
          packagesRoster,
          rosterFromNotionMirror(
            notionRosterByInstanceId.get(instance.id) ?? [],
            profileById,
            emailById
          )
        )
      : packagesRoster;

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
      tutorIdSource: resolveTutorIdSource(instance.tutor_id_source),
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
      weeklySessionStart: null,
      weeklySessionEnd: null,
      calendarLinkState: "n_a",
      calendarNeedsAttention: false,
      calendarLinkedEvent: null,
      tutorCalendarLastSyncedAt: null,
    });
  }

  const communityRow = await loadCommunityPackageRow(supabase, profileById, courseById);
  if (communityRow) {
    rows.unshift(communityRow);
  }

  return { rows };
}

async function loadCommunityPackageRow(
  supabase: SupabaseClient,
  profileById: Map<string, ProfileRow>,
  courseById: Map<string, string>
): Promise<AdminPackageListRow | null> {
  const communityProduct = await fetchCommunityPackageProduct(supabase);
  if (!communityProduct) return null;

  const { data: communityMembers } = await supabase
    .from("student_packages")
    .select("id, user_id, status")
    .eq("package_id", communityProduct.id)
    .is("package_instance_id", null);

  const userIds = (communityMembers ?? []).map((row) => row.user_id);
  const emailById = await loadEmails(supabase, userIds);

  const roster = rosterFromPackages(
    (communityMembers ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      status: row.status as PackageMembershipStatus,
    })),
    profileById,
    emailById
  );

  return {
    kind: "community",
    id: communityProduct.id,
    name: communityProduct.name,
    courseId: communityProduct.courseId,
    courseName: courseById.get(communityProduct.courseId) ?? "Community",
    packageId: communityProduct.id,
    tutorId: null,
    tutorName: null,
    tutorIdSource: "notion",
    status: "in_progress",
    startDayOfWeek: null,
    startDate: null,
    endDate: null,
    capacity: 9999,
    deliveryMode: null,
    active: communityProduct.active,
    ...roster,
    lessonUnlockCount: 0,
    lastLessonLoggedAt: null,
    weeklySessionStart: null,
    weeklySessionEnd: null,
    calendarLinkState: "n_a",
    calendarNeedsAttention: false,
    calendarLinkedEvent: null,
    tutorCalendarLastSyncedAt: null,
  };
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

  if (kind === "community") {
    const product = await fetchCommunityPackageProduct(supabase);
    active = product?.active ?? true;
    packageId = product?.id ?? null;
    packageName = product?.name ?? null;
  } else if (kind === "cohort") {
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
  } else if (kind === "package_instance") {
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

  const lessonLog =
    kind === "community"
      ? []
      : await loadLessonLog(supabase, kind, id, base.courseId);

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
  if (kind === "community") {
    return [];
  }

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
