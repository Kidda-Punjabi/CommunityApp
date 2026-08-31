import { getDisplayName } from "@/lib/profile/display-name";
import { canManageCohort } from "@/lib/tutoring/tutor-access";
import { isStoredSessionExcluded } from "@/lib/calendar/exclusions";
import type { CalendarExclusionRow } from "@/lib/calendar/exclusions";
import { localDateKey, todayDateKey } from "@/lib/calendar/day-bounds";
import { loadTutorAvailability } from "@/lib/tutoring/availability/load-availability";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TutorStudentRow = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  courseId: string;
  courseName: string;
  courseTier: string | null;
};

export type TutorCohortRow = {
  cohortId: string;
  cohortName: string;
  courseId: string;
  courseName: string;
  memberCount: number;
  studentNames: string[];
};

export type TutorDashboardData = {
  foundationalStudents: TutorStudentRow[];
  beginnersOneToOne: TutorStudentRow[];
  beginnersGroups: TutorCohortRow[];
};

export type TutorTodayLessonRow = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetLink: string | null;
  studentName: string | null;
  cohortName: string | null;
};

export type TutorAssignedPackageRow = {
  id: string;
  kind: "cohort" | "package_instance";
  name: string;
  courseName: string;
  memberCount: number;
  capacity: number | null;
  status: string | null;
  href: string;
};

export async function loadTutorDashboard(
  supabase: SupabaseClient,
  tutorId: string
): Promise<TutorDashboardData> {
  const { data: enrollmentRows, error } = await supabase
    .from("course_enrollments")
    .select("id, user_id, course_id, delivery_mode, cohort_id, courses(id, name, required_tier)")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const studentIds = [...new Set((enrollmentRows ?? []).map((row) => row.user_id))];
  const cohortIds = [
    ...new Set(
      (enrollmentRows ?? [])
        .map((row) => row.cohort_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [
    { data: profiles },
    { data: cohortRows },
    { data: assignedCohortRows },
    { data: coverCohortIdRows, error: coverCohortIdsError },
    { data: memberRows },
  ] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", studentIds)
      : Promise.resolve({
          data: [] as { id: string; full_name: string | null; preferred_name: string | null }[],
        }),
    cohortIds.length > 0
      ? supabase.from("cohorts").select("id, name, course_id").in("id", cohortIds)
      : Promise.resolve({ data: [] as { id: string; name: string; course_id: string }[] }),
    supabase.from("cohorts").select("id, name, course_id").eq("tutor_id", tutorId),
    supabase.rpc("tutor_cover_cohort_ids"),
    cohortIds.length > 0
      ? supabase
          .from("cohort_members")
          .select("cohort_id, user_id")
          .in("cohort_id", cohortIds)
          .is("left_at", null)
      : Promise.resolve({ data: [] as { cohort_id: string; user_id: string }[] }),
  ]);

  const coverCohortIds = [
    ...new Set(
      (Array.isArray(coverCohortIdRows) ? coverCohortIdRows : [])
        .map((id) => (typeof id === "string" ? id : null))
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (coverCohortIdsError && !coverCohortIdsError.message.includes("tutor_cover_cohort_ids")) {
    console.error("[tutor-dashboard] tutor_cover_cohort_ids failed", coverCohortIdsError.message);
  }

  const knownCohortIds = new Set([
    ...cohortIds,
    ...(assignedCohortRows ?? []).map((row) => row.id),
  ]);
  const missingCoverIds = coverCohortIds.filter((id) => !knownCohortIds.has(id));
  const { data: coverCohortRows } =
    missingCoverIds.length > 0
      ? await supabase
          .from("cohorts")
          .select("id, name, course_id, courses(name)")
          .in("id", missingCoverIds)
      : { data: [] as Array<{
          id: string;
          name: string;
          course_id: string;
          courses: { name: string } | { name: string }[] | null;
        }> };

  const allCohortIds = [
    ...new Set([
      ...cohortIds,
      ...(assignedCohortRows ?? []).map((row) => row.id),
      ...coverCohortIds,
    ]),
  ];

  let membersByCohortFromDb = memberRows ?? [];
  if (allCohortIds.length > cohortIds.length) {
    const { data: extraMembers } = await supabase
      .from("cohort_members")
      .select("cohort_id, user_id")
      .in("cohort_id", allCohortIds)
      .is("left_at", null);
    membersByCohortFromDb = extraMembers ?? [];
  }

  const nameById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      getDisplayName(profile) ?? "Student",
    ] as const)
  );

  const cohortMemberUserIds = [
    ...new Set(membersByCohortFromDb.map((member) => member.user_id)),
  ];
  const missingProfileIds = cohortMemberUserIds.filter((id) => !studentIds.includes(id));

  if (missingProfileIds.length > 0) {
    const { data: memberProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in("id", missingProfileIds);

    for (const profile of memberProfiles ?? []) {
      if (!nameById.has(profile.id)) {
        nameById.set(profile.id, getDisplayName(profile) ?? "Student");
      }
    }
  }

  const cohortNameById = new Map(
    [
      ...(cohortRows ?? []),
      ...(assignedCohortRows ?? []),
      ...(coverCohortRows ?? []),
    ].map((c) => [c.id, c.name] as const)
  );
  const membersByCohort = new Map<string, string[]>();
  for (const member of membersByCohortFromDb) {
    const list = membersByCohort.get(member.cohort_id) ?? [];
    list.push(nameById.get(member.user_id) ?? "Student");
    membersByCohort.set(member.cohort_id, list);
  }

  const foundationalStudents: TutorStudentRow[] = [];
  const beginnersOneToOne: TutorStudentRow[] = [];
  const beginnersGroupsMap = new Map<string, TutorCohortRow>();

  for (const row of enrollmentRows ?? []) {
    const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    const tier = course?.required_tier ?? null;
    const courseName = course?.name ?? "Course";

    if (row.delivery_mode === "group" && row.cohort_id) {
      if (!beginnersGroupsMap.has(row.cohort_id)) {
        const members = membersByCohort.get(row.cohort_id) ?? [];
        beginnersGroupsMap.set(row.cohort_id, {
          cohortId: row.cohort_id,
          cohortName: cohortNameById.get(row.cohort_id) ?? "Cohort",
          courseId: row.course_id,
          courseName,
          memberCount: members.length,
          studentNames: members,
        });
      }
      continue;
    }

    const studentRow: TutorStudentRow = {
      enrollmentId: row.id,
      studentId: row.user_id,
      studentName: nameById.get(row.user_id) ?? "Student",
      studentEmail: null,
      courseId: row.course_id,
      courseName,
      courseTier: tier,
    };

    if (tier === "foundational") {
      foundationalStudents.push(studentRow);
    } else if (tier === "beginners") {
      beginnersOneToOne.push(studentRow);
    }
  }

  for (const cohort of assignedCohortRows ?? []) {
    if (beginnersGroupsMap.has(cohort.id)) continue;

    const members = membersByCohort.get(cohort.id) ?? [];
    const course = (enrollmentRows ?? []).find((row) => row.course_id === cohort.course_id);
    const courseFromJoin = course
      ? Array.isArray(course.courses)
        ? course.courses[0]
        : course.courses
      : null;

    beginnersGroupsMap.set(cohort.id, {
      cohortId: cohort.id,
      cohortName: cohort.name,
      courseId: cohort.course_id,
      courseName: courseFromJoin?.name ?? "Beginners",
      memberCount: members.length,
      studentNames: members,
    });
  }

  for (const cohort of coverCohortRows ?? []) {
    if (beginnersGroupsMap.has(cohort.id)) continue;
    const members = membersByCohort.get(cohort.id) ?? [];
    const courseJoin = Array.isArray(cohort.courses) ? cohort.courses[0] : cohort.courses;
    beginnersGroupsMap.set(cohort.id, {
      cohortId: cohort.id,
      cohortName: cohort.name,
      courseId: cohort.course_id,
      courseName: courseJoin?.name ?? "Beginners",
      memberCount: members.length,
      studentNames: members,
    });
  }

  return {
    foundationalStudents,
    beginnersOneToOne,
    beginnersGroups: [...beginnersGroupsMap.values()].sort((a, b) =>
      a.cohortName.localeCompare(b.cohortName)
    ),
  };
}

export async function loadTutorTodayLessons(
  supabase: SupabaseClient,
  tutorId: string
): Promise<TutorTodayLessonRow[]> {
  const { settings } = await loadTutorAvailability(supabase, tutorId);
  const timeZone = settings.timezone;
  const todayKey = todayDateKey(timeZone);

  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - 24);
  const windowEnd = new Date();
  windowEnd.setHours(windowEnd.getHours() + 48);

  const [{ data: rows }, { data: exclusions }] = await Promise.all([
    supabase
      .from("tutor_scheduled_sessions")
      .select("id, title, starts_at, ends_at, meet_link, student_id, cohort_id, google_event_id, google_recurring_event_id")
      .eq("tutor_id", tutorId)
      .eq("status", "scheduled")
      .gte("starts_at", windowStart.toISOString())
      .lt("starts_at", windowEnd.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("tutor_calendar_event_exclusions")
      .select("google_event_id, google_recurring_event_id, scope")
      .eq("tutor_id", tutorId),
  ]);

  const exclusionRows = (exclusions ?? []) as CalendarExclusionRow[];
  const sessions = (rows ?? []).filter((row) => {
    if (localDateKey(row.starts_at, timeZone) !== todayKey) return false;
    return !isStoredSessionExcluded(
      {
        google_event_id: row.google_event_id,
        google_recurring_event_id: row.google_recurring_event_id,
      },
      exclusionRows
    );
  });

  if (sessions.length === 0) return [];

  const studentIds = [
    ...new Set(sessions.map((row) => row.student_id).filter((id): id is string => Boolean(id))),
  ];
  const cohortIds = [
    ...new Set(sessions.map((row) => row.cohort_id).filter((id): id is string => Boolean(id))),
  ];

  const [{ data: profiles }, { data: cohorts }] = await Promise.all([
    studentIds.length > 0
      ? supabase.from("profiles").select("id, full_name, preferred_name").in("id", studentIds)
      : Promise.resolve({ data: [] }),
    cohortIds.length > 0
      ? supabase.from("cohorts").select("id, name").in("id", cohortIds)
      : Promise.resolve({ data: [] }),
  ]);

  const studentNameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, getDisplayName(profile) ?? "Student"] as const)
  );
  const cohortNameById = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort.name] as const));

  return sessions.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    meetLink: row.meet_link,
    studentName: row.student_id ? (studentNameById.get(row.student_id) ?? null) : null,
    cohortName: row.cohort_id ? (cohortNameById.get(row.cohort_id) ?? null) : null,
  }));
}

export async function loadTutorAssignedPackages(
  supabase: SupabaseClient,
  tutorId: string
): Promise<TutorAssignedPackageRow[]> {
  const [{ data: cohorts }, { data: instances }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name, course_id, courses(name), capacity, status")
      .eq("tutor_id", tutorId)
      .order("created_at", { ascending: false }),
    supabase
      .from("package_instances")
      .select("id, name, course_id, courses(name), capacity, status")
      .eq("tutor_id", tutorId)
      .order("created_at", { ascending: false }),
  ]);

  const cohortIds = (cohorts ?? []).map((row) => row.id);
  const instanceIds = (instances ?? []).map((row) => row.id);

  const [{ data: cohortMembers }, { data: instancePackages }] = await Promise.all([
    cohortIds.length > 0
      ? supabase
          .from("cohort_members")
          .select("cohort_id")
          .in("cohort_id", cohortIds)
          .is("left_at", null)
      : Promise.resolve({ data: [] }),
    instanceIds.length > 0
      ? supabase
          .from("student_packages")
          .select("package_instance_id")
          .in("package_instance_id", instanceIds)
          .neq("status", "cancelled")
      : Promise.resolve({ data: [] }),
  ]);

  const cohortCount = new Map<string, number>();
  for (const row of cohortMembers ?? []) {
    cohortCount.set(row.cohort_id, (cohortCount.get(row.cohort_id) ?? 0) + 1);
  }
  const instanceCount = new Map<string, number>();
  for (const row of instancePackages ?? []) {
    if (!row.package_instance_id) continue;
    instanceCount.set(
      row.package_instance_id,
      (instanceCount.get(row.package_instance_id) ?? 0) + 1
    );
  }

  const result: TutorAssignedPackageRow[] = [];

  for (const row of cohorts ?? []) {
    const courseRel = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    result.push({
      id: row.id,
      kind: "cohort",
      name: row.name,
      courseName: courseRel?.name ?? "Course",
      memberCount: cohortCount.get(row.id) ?? 0,
      capacity: row.capacity ?? null,
      status: row.status ?? null,
      href: `/dashboard/tutor/cohort/${row.id}`,
    });
  }

  for (const row of instances ?? []) {
    const courseRel = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    result.push({
      id: row.id,
      kind: "package_instance",
      name: row.name,
      courseName: courseRel?.name ?? "Course",
      memberCount: instanceCount.get(row.id) ?? 0,
      capacity: row.capacity ?? null,
      status: row.status ?? null,
      href: "/dashboard/tutor/lessons",
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildTutorAssignmentRows(data: TutorDashboardData): TutorAssignedPackageRow[] {
  const rows: TutorAssignedPackageRow[] = [];

  for (const cohort of data.beginnersGroups) {
    rows.push({
      id: cohort.cohortId,
      kind: "cohort",
      name: cohort.cohortName,
      courseName: cohort.courseName,
      memberCount: cohort.memberCount,
      capacity: null,
      status: null,
      href: `/dashboard/tutor/cohort/${cohort.cohortId}`,
    });
  }

  for (const student of [...data.foundationalStudents, ...data.beginnersOneToOne]) {
    rows.push({
      id: student.studentId,
      kind: "package_instance",
      name: student.studentName,
      courseName: student.courseName,
      memberCount: 1,
      capacity: 1,
      status: null,
      href: `/dashboard/tutor/student/${student.studentId}/${student.courseId}`,
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export type TutorLessonRow = {
  id: string;
  lessonNumber: number;
  title: string;
  unlocked: boolean;
  recordingUrl: string | null;
  recordingId: string | null;
};

export async function loadTutorStudentLessons(
  supabase: SupabaseClient,
  tutorId: string,
  studentId: string,
  courseId: string
): Promise<{
  studentName: string;
  courseName: string;
  lessons: TutorLessonRow[];
} | null> {
  const { data: enrollment, error } = await supabase
    .from("course_enrollments")
    .select("id, user_id, course_id, delivery_mode")
    .eq("tutor_id", tutorId)
    .eq("user_id", studentId)
    .eq("course_id", courseId)
    .or("delivery_mode.is.null,delivery_mode.eq.one_to_one")
    .maybeSingle();

  if (error) throw error;
  if (!enrollment) return null;

  const [{ data: profile }, { data: course }, { data: lessons }, { data: unlocks }, { data: recordings }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, preferred_name")
        .eq("id", studentId)
        .maybeSingle(),
      supabase.from("courses").select("name").eq("id", courseId).maybeSingle(),
      supabase
        .from("lessons")
        .select("id, lesson_number, title")
        .eq("course_id", courseId)
        .order("lesson_number"),
      supabase
        .from("student_lesson_unlocks")
        .select("lesson_id")
        .eq("student_id", studentId),
      supabase
        .from("lesson_recordings")
        .select("id, lesson_id, storage_path")
        .eq("student_id", studentId),
    ]);

  const unlockedIds = new Set((unlocks ?? []).map((row) => row.lesson_id));
  const recordingByLesson = new Map(
    (recordings ?? []).map((row) => [row.lesson_id, row] as const)
  );

  return {
    studentName: getDisplayName(profile) ?? "Student",
    courseName: course?.name ?? "Course",
    lessons: (lessons ?? []).map((lesson) => {
      const recording = recordingByLesson.get(lesson.id);
      return {
        id: lesson.id,
        lessonNumber: lesson.lesson_number,
        title: lesson.title,
        unlocked: unlockedIds.has(lesson.id),
        recordingUrl: recording?.storage_path ?? null,
        recordingId: recording?.id ?? null,
      };
    }),
  };
}

export async function loadTutorCohortLessons(
  supabase: SupabaseClient,
  tutorId: string,
  cohortId: string
): Promise<{
  cohortName: string;
  courseName: string;
  members: { userId: string; name: string }[];
  lessons: TutorLessonRow[];
} | null> {
  const allowed = await canManageCohort(supabase, tutorId, cohortId);
  if (!allowed) return null;

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, name, course_id, courses(name)")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError) throw cohortError;

  let cohortName = cohort?.name ?? "Cohort";
  let courseId = cohort?.course_id ?? null;
  let courseName =
    (Array.isArray(cohort?.courses) ? cohort.courses[0] : cohort?.courses)?.name ?? null;

  if (!courseId) {
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("course_id, courses(name)")
      .eq("tutor_id", tutorId)
      .eq("cohort_id", cohortId)
      .limit(1)
      .maybeSingle();

    if (!enrollment) return null;

    courseId = enrollment.course_id;
    const course = Array.isArray(enrollment.courses)
      ? enrollment.courses[0]
      : enrollment.courses;
    courseName = course?.name ?? "Course";
  }

  const [{ data: lessons }, { data: unlocks }, { data: recordings }, { data: memberRows }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, lesson_number, title")
        .eq("course_id", courseId)
        .order("lesson_number"),
      supabase.from("cohort_lesson_unlocks").select("lesson_id").eq("cohort_id", cohortId),
      supabase.from("lesson_recordings").select("id, lesson_id, storage_path").eq("cohort_id", cohortId),
      supabase
        .from("cohort_members")
        .select("user_id")
        .eq("cohort_id", cohortId)
        .is("left_at", null),
    ]);

  const memberIds = (memberRows ?? []).map((row) => row.user_id);
  const { data: profiles } =
    memberIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", memberIds)
      : { data: [] };

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, getDisplayName(p) ?? "Member"] as const)
  );

  const unlockedIds = new Set((unlocks ?? []).map((row) => row.lesson_id));
  const recordingByLesson = new Map(
    (recordings ?? []).map((row) => [row.lesson_id, row] as const)
  );

  return {
    cohortName,
    courseName: courseName ?? "Course",
    members: memberIds.map((userId) => ({
      userId,
      name: nameById.get(userId) ?? "Member",
    })),
    lessons: (lessons ?? []).map((lesson) => {
      const recording = recordingByLesson.get(lesson.id);
      return {
        id: lesson.id,
        lessonNumber: lesson.lesson_number,
        title: lesson.title,
        unlocked: unlockedIds.has(lesson.id),
        recordingUrl: recording?.storage_path ?? null,
        recordingId: recording?.id ?? null,
      };
    }),
  };
}
