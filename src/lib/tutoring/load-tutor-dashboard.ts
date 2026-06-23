import { getDisplayName } from "@/lib/profile/display-name";
import { canManageCohort } from "@/lib/tutoring/tutor-access";
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
    cohortIds.length > 0
      ? supabase
          .from("cohort_members")
          .select("cohort_id, user_id")
          .in("cohort_id", cohortIds)
          .is("left_at", null)
      : Promise.resolve({ data: [] as { cohort_id: string; user_id: string }[] }),
  ]);

  const allCohortIds = [
    ...new Set([
      ...cohortIds,
      ...(assignedCohortRows ?? []).map((row) => row.id),
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

  const cohortNameById = new Map(
    [...(cohortRows ?? []), ...(assignedCohortRows ?? [])].map(
      (c) => [c.id, c.name] as const
    )
  );
  const membersByCohort = new Map<string, string[]>();
  for (const member of membersByCohortFromDb) {
    const list = membersByCohort.get(member.cohort_id) ?? [];
    list.push(nameById.get(member.user_id) ?? "Member");
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

  return {
    foundationalStudents,
    beginnersOneToOne,
    beginnersGroups: [...beginnersGroupsMap.values()].sort((a, b) =>
      a.cohortName.localeCompare(b.cohortName)
    ),
  };
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
