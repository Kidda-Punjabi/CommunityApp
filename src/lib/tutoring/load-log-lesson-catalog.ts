import "server-only";

import { getDisplayName } from "@/lib/profile/display-name";
import {
  kidProfileIdsInCohort,
  loadCohortMembershipRoster,
} from "@/lib/tutoring/cohort-attendance";
import {
  isActiveTeachingClass,
  isFoundationalCourse,
  suggestNextLesson,
} from "@/lib/tutoring/log-lesson-copy";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LogRosterPerson = {
  id: string;
  name: string;
  kind: "student" | "kid";
};

export type LogLessonChoice = {
  lessonId: string;
  lessonNumber: number;
  title: string;
  logged: boolean;
};

export type LogPinnedNote = {
  lessonNumber: number;
  notes: string;
};

export type LogCohortOption = {
  id: string;
  name: string;
  courseName: string;
  foundational: boolean;
  schedule: string;
  studentCount: number;
  students: LogRosterPerson[];
  lessons: LogLessonChoice[];
  loggedCount: number;
  totalLessons: number;
  nextLessonNumber: number | null;
  nextLessonTitle: string | null;
  pinnedNote: LogPinnedNote | null;
};

export type LogStudentOption = {
  packageInstanceId: string;
  studentName: string;
  studentId: string | null;
  kidProfileId: string | null;
  recordingStudentId: string | null;
  courseName: string;
  foundational: boolean;
  schedule: string;
  lessons: LogLessonChoice[];
  loggedCount: number;
  totalLessons: number;
  nextLessonNumber: number | null;
  nextLessonTitle: string | null;
  pinnedNote: LogPinnedNote | null;
};

export type LogLessonCatalog = {
  cohorts: LogCohortOption[];
  students: LogStudentOption[];
};

type CourseRow = { id: string; name: string };
type LessonRow = { id: string; course_id: string; lesson_number: number; title: string };
type LogRow = {
  cohort_id: string | null;
  package_instance_id: string | null;
  lesson_id: string | null;
  lesson_date: string | null;
  notes: string | null;
  status: string | null;
  dismissed_at: string | null;
};

function scheduleLabel(day: string | null | undefined, weeklyStart: string | null | undefined): string {
  const weekday = day?.trim() ?? "";
  let time = "";
  if (weeklyStart) {
    const parsed = new Date(weeklyStart);
    if (!Number.isNaN(parsed.getTime())) {
      time = new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Europe/London",
      }).format(parsed);
    }
  }
  return [weekday, time].filter(Boolean).join(" · ") || "Schedule not set";
}

function countable(row: LogRow): boolean {
  return row.status !== "Cancelled" && !row.dismissed_at && Boolean(row.lesson_id);
}

function buildLessons(
  lessons: LessonRow[],
  loggedIds: Set<string>
): { choices: LogLessonChoice[]; loggedCount: number; next: LessonRow | null } {
  const sorted = [...lessons].sort((a, b) => a.lesson_number - b.lesson_number);
  const choices = sorted.map((lesson) => ({
    lessonId: lesson.id,
    lessonNumber: lesson.lesson_number,
    title: lesson.title,
    logged: loggedIds.has(lesson.id),
  }));
  const next = suggestNextLesson(
    sorted.map((lesson) => ({
      lessonId: lesson.id,
      lessonNumber: lesson.lesson_number,
      title: lesson.title,
    })),
    loggedIds
  );
  const nextRow = next ? sorted.find((lesson) => lesson.id === next.lessonId) ?? null : null;
  return {
    choices,
    loggedCount: choices.filter((lesson) => lesson.logged).length,
    next: nextRow,
  };
}

function pinnedNote(
  rows: LogRow[],
  lessonNumberById: Map<string, number>
): LogPinnedNote | null {
  const latest = rows
    .filter(countable)
    .sort((a, b) => (b.lesson_date ?? "").localeCompare(a.lesson_date ?? ""))[0];
  const notes = latest?.notes?.trim() ?? "";
  if (!latest?.lesson_id || !notes) return null;
  const lessonNumber = lessonNumberById.get(latest.lesson_id);
  if (!lessonNumber) return null;
  return { lessonNumber, notes };
}

export async function loadLogLessonCatalog(
  reader: SupabaseClient,
  tutorId: string,
  options?: { includeTest?: boolean }
): Promise<LogLessonCatalog> {
  const [{ data: cohortRows }, { data: instanceRows }] = await Promise.all([
    reader
      .from("cohorts")
      .select(
        "id, name, status, active, course_id, tutor_id, start_day_of_week, weekly_session_start, notion_page_id"
      )
      .eq("tutor_id", tutorId),
    reader
      .from("package_instances")
      .select(
        "id, name, status, active, course_id, tutor_id, start_day_of_week, notion_page_id, package_id"
      )
      .eq("tutor_id", tutorId),
  ]);

  const activeCohorts = (cohortRows ?? []).filter((row) =>
    isActiveTeachingClass(
      {
        name: row.name as string,
        active: row.active as boolean | null,
        status: row.status as string | null,
      },
      options
    )
  );
  const activeInstances = (instanceRows ?? []).filter((row) =>
    isActiveTeachingClass(
      {
        name: row.name as string,
        active: row.active as boolean | null,
        status: row.status as string | null,
      },
      options
    )
  );

  const courseIds = [
    ...new Set(
      [...activeCohorts, ...activeInstances]
        .map((row) => row.course_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const cohortIds = activeCohorts.map((row) => row.id as string);
  const instanceIds = activeInstances.map((row) => row.id as string);

  const [{ data: courseRows }, { data: lessonRows }, { data: logRows }, { data: packageRows }] =
    await Promise.all([
      courseIds.length
        ? reader.from("courses").select("id, name").in("id", courseIds)
        : Promise.resolve({ data: [] as CourseRow[] }),
      courseIds.length
        ? reader
            .from("lessons")
            .select("id, course_id, lesson_number, title")
            .in("course_id", courseIds)
        : Promise.resolve({ data: [] as LessonRow[] }),
      cohortIds.length || instanceIds.length
        ? reader
            .from("cohort_lesson_log_entries")
            .select(
              "cohort_id, package_instance_id, lesson_id, lesson_date, notes, status, dismissed_at"
            )
            .or(
              [
                cohortIds.length ? `cohort_id.in.(${cohortIds.join(",")})` : "",
                instanceIds.length ? `package_instance_id.in.(${instanceIds.join(",")})` : "",
              ]
                .filter(Boolean)
                .join(",")
            )
        : Promise.resolve({ data: [] as LogRow[] }),
      activeInstances.length
        ? reader
            .from("packages")
            .select("id, delivery_mode")
            .in(
              "id",
              [...new Set(activeInstances.map((row) => row.package_id as string).filter(Boolean))]
            )
        : Promise.resolve({ data: [] as Array<{ id: string; delivery_mode: string | null }> }),
    ]);

  const courseName = new Map((courseRows ?? []).map((row) => [row.id, row.name] as const));
  const lessonsByCourse = new Map<string, LessonRow[]>();
  for (const lesson of (lessonRows ?? []) as LessonRow[]) {
    const list = lessonsByCourse.get(lesson.course_id) ?? [];
    list.push(lesson);
    lessonsByCourse.set(lesson.course_id, list);
  }
  const logs = (logRows ?? []) as LogRow[];

  const cohorts: LogCohortOption[] = [];
  for (const cohort of activeCohorts) {
    const courseId = cohort.course_id as string;
    const name = courseName.get(courseId) ?? "Course";
    const foundational = isFoundationalCourse(name);
    const courseLessons = lessonsByCourse.get(courseId) ?? [];
    const lessonNumberById = new Map(courseLessons.map((lesson) => [lesson.id, lesson.lesson_number]));
    const cohortLogs = logs.filter((row) => row.cohort_id === cohort.id);
    const loggedIds = new Set(
      cohortLogs.filter(countable).map((row) => row.lesson_id).filter((id): id is string => Boolean(id))
    );
    const built = buildLessons(courseLessons, loggedIds);
    const [roster, kidIds] = await Promise.all([
      loadCohortMembershipRoster(reader, cohort.id as string),
      kidProfileIdsInCohort(reader, cohort.id as string),
    ]);
    const students: LogRosterPerson[] = roster
      .filter((student) => student.isActiveMember)
      .map((student) => ({
        id: student.studentId,
        name: student.studentName,
        kind: kidIds.has(student.studentId) ? "kid" : "student",
      }));
    cohorts.push({
      id: cohort.id as string,
      name: (cohort.name as string) || "Cohort",
      courseName: name,
      foundational,
      schedule: scheduleLabel(
        cohort.start_day_of_week as string | null,
        cohort.weekly_session_start as string | null
      ),
      studentCount: students.length,
      students,
      lessons: built.choices,
      loggedCount: built.loggedCount,
      totalLessons: built.choices.length,
      nextLessonNumber: built.next?.lesson_number ?? null,
      nextLessonTitle: built.next?.title ?? null,
      pinnedNote: pinnedNote(cohortLogs, lessonNumberById),
    });
  }

  const deliveryByPackage = new Map(
    (packageRows ?? []).map((row) => [row.id, row.delivery_mode] as const)
  );
  const oneToOneInstances = activeInstances.filter((row) => {
    const mode = deliveryByPackage.get(row.package_id as string);
    return mode == null || mode === "one_to_one";
  });
  const oneToOneIds = oneToOneInstances.map((row) => row.id as string);
  const { data: studentPackageRows } = oneToOneIds.length
    ? await reader
        .from("student_packages")
        .select("user_id, package_instance_id, status")
        .in("package_instance_id", oneToOneIds)
        .neq("status", "withdrawn")
    : { data: [] as Array<{ user_id: string; package_instance_id: string; status: string }> };

  const parentIds = [
    ...new Set((studentPackageRows ?? []).map((row) => row.user_id).filter(Boolean)),
  ];
  const [{ data: profiles }, { data: enrollments }] = await Promise.all([
    parentIds.length
      ? reader.from("profiles").select("id, full_name, preferred_name").in("id", parentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }> }),
    parentIds.length
      ? reader
          .from("course_enrollments")
          .select("user_id, course_id, tutor_id, kid_profile_id, delivery_mode")
          .in("user_id", parentIds)
          .eq("tutor_id", tutorId)
      : Promise.resolve({
          data: [] as Array<{
            user_id: string;
            course_id: string;
            tutor_id: string;
            kid_profile_id: string | null;
            delivery_mode: string | null;
          }>,
        }),
  ]);
  const profileName = new Map(
    (profiles ?? []).map((profile) => [profile.id, getDisplayName(profile) ?? ""] as const)
  );
  const kidIds = [
    ...new Set(
      (enrollments ?? [])
        .map((row) => row.kid_profile_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: kids } = kidIds.length
    ? await reader.from("kid_profiles").select("id, name").in("id", kidIds)
    : { data: [] as Array<{ id: string; name: string | null }> };
  const kidName = new Map((kids ?? []).map((kid) => [kid.id, kid.name?.trim() ?? ""] as const));

  const students: LogStudentOption[] = [];
  for (const instance of oneToOneInstances) {
    const links = (studentPackageRows ?? []).filter((row) => row.package_instance_id === instance.id);
    if (links.length !== 1) continue;
    const parentId = links[0]!.user_id;
    const courseId = instance.course_id as string;
    const enrollment = (enrollments ?? []).find(
      (row) =>
        row.user_id === parentId &&
        row.course_id === courseId &&
        row.delivery_mode !== "group"
    );
    const kidProfileId = enrollment?.kid_profile_id ?? null;
    const studentName = kidProfileId
      ? kidName.get(kidProfileId) || ""
      : profileName.get(parentId) || "";
    if (!studentName) continue;

    const course = courseName.get(courseId) ?? "Course";
    const foundational = isFoundationalCourse(course);
    const courseLessons = lessonsByCourse.get(courseId) ?? [];
    const lessonNumberById = new Map(courseLessons.map((lesson) => [lesson.id, lesson.lesson_number]));
    const instanceLogs = logs.filter((row) => row.package_instance_id === instance.id);
    const loggedIds = new Set(
      instanceLogs.filter(countable).map((row) => row.lesson_id).filter((id): id is string => Boolean(id))
    );
    const built = buildLessons(courseLessons, loggedIds);
    students.push({
      packageInstanceId: instance.id as string,
      studentName,
      studentId: kidProfileId ? null : parentId,
      kidProfileId,
      recordingStudentId: parentId,
      courseName: course,
      foundational,
      schedule: scheduleLabel(instance.start_day_of_week as string | null, null),
      lessons: built.choices,
      loggedCount: built.loggedCount,
      totalLessons: built.choices.length,
      nextLessonNumber: built.next?.lesson_number ?? null,
      nextLessonTitle: built.next?.title ?? null,
      pinnedNote: pinnedNote(instanceLogs, lessonNumberById),
    });
  }

  cohorts.sort((a, b) => a.name.localeCompare(b.name));
  students.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return { cohorts, students };
}
