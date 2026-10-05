import "server-only";

import { coverTaughtByLabel } from "@/lib/tutoring/cover-lesson";
import type { LessonLogEditAttendance } from "@/lib/tutoring/lesson-log-edit";
import { getDisplayName } from "@/lib/profile/display-name";
import {
  kidProfileIdsInCohort,
  loadCohortMembershipRoster,
} from "@/lib/tutoring/cohort-attendance";
import {
  formatTaughtDate,
  isActiveTeachingClass,
  isFinishedTeachingClass,
  isTestClassName,
  lessonSlotLabel,
  suggestNextLesson,
} from "@/lib/tutoring/log-lesson-copy";
import {
  classIssue,
  classTypePill,
  lowestLessonNumber,
  packageNameMatchesStudent,
  type ClassIssue,
} from "@/lib/tutoring/tutor-class-status";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TutorClassCard = {
  id: string;
  kind: "group" | "one_to_one";
  href: string;
  name: string;
  pill: string;
  schedule: string;
  loggedCount: number;
  totalLessons: number;
  nextLabel: string | null;
  issue: ClassIssue;
  studentCount: number;
};

export type TutorClassBoard = {
  active: TutorClassCard[];
  finished: TutorClassCard[];
  groupCount: number;
  groupStudentCount: number;
  oneToOneCount: number;
};

export type ClassLessonRow = {
  lessonId: string;
  lessonNumber: number;
  title: string;
  state: "logged" | "next" | "future";
  entryId: string | null;
  dateLabel: string | null;
  present: number;
  total: number;
  hasRecording: boolean;
  notes: string | null;
  homeworkLabel: string | null;
  unlockEarly: boolean;
  coverLabel: string | null;
  recordingUrl: string;
  isCoverSession: boolean;
  actualTutorId: string | null;
  attendance: LessonLogEditAttendance[];
};

export type ClassDetail = {
  kind: "group" | "one_to_one";
  name: string;
  courseName: string;
  courseId: string;
  schedule: string;
  loggedCount: number;
  totalLessons: number;
  attendancePercent: number | null;
  recordingsMissing: number;
  pinned: { lessonNumber: number; notes: string } | null;
  lessons: ClassLessonRow[];
  students: Array<{ id: string; name: string }>;
  logHref: string;
  unlockStudentId: string | null;
  unlockKidProfileId: string | null;
  recordingStudentId: string | null;
};

type LessonRow = { id: string; course_id: string; lesson_number: number; title: string };
type LogRow = {
  id: string;
  cohort_id: string | null;
  package_instance_id: string | null;
  lesson_id: string | null;
  lesson_date: string | null;
  notes: string | null;
  recording_url: string | null;
  status: string | null;
  dismissed_at: string | null;
  is_cover_session?: boolean | null;
  actual_tutor_id?: string | null;
};
type Person = { id: string; name: string; kind: "student" | "kid" };

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

function homeworkLabel(status: string | null, approved: boolean | null): string {
  if (!status) return "Not submitted";
  if (status === "reviewed") return approved ? "Approved" : "Needs another try";
  return "Submitted";
}

async function courseNames(reader: SupabaseClient, courseIds: string[]) {
  if (courseIds.length === 0) return new Map<string, string>();
  const { data } = await reader.from("courses").select("id, name").in("id", courseIds);
  return new Map((data ?? []).map((row) => [row.id as string, row.name as string]));
}

async function lessonsByCourse(reader: SupabaseClient, courseIds: string[]) {
  const map = new Map<string, LessonRow[]>();
  if (courseIds.length === 0) return map;
  const { data } = await reader
    .from("lessons")
    .select("id, course_id, lesson_number, title")
    .in("course_id", courseIds);
  for (const row of (data ?? []) as LessonRow[]) {
    const list = map.get(row.course_id) ?? [];
    list.push(row);
    map.set(row.course_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.lesson_number - b.lesson_number);
  return map;
}

export async function loadTutorClassBoard(
  reader: SupabaseClient,
  tutorId: string
): Promise<TutorClassBoard> {
  const [{ data: cohortRows }, { data: instanceRows }] = await Promise.all([
    reader
      .from("cohorts")
      .select("id, name, status, active, course_id, start_day_of_week, weekly_session_start")
      .eq("tutor_id", tutorId),
    reader
      .from("package_instances")
      .select("id, name, status, active, course_id, start_day_of_week, package_id")
      .eq("tutor_id", tutorId),
  ]);

  const visibleCohorts = (cohortRows ?? []).filter((row) => !isTestClassName(row.name as string));
  const visibleInstances = (instanceRows ?? []).filter((row) => !isTestClassName(row.name as string));
  const oneToOneIds = visibleInstances.map((row) => row.id as string);
  const packageIds = [...new Set(visibleInstances.map((row) => row.package_id as string).filter(Boolean))];
  const { data: packageRows } = packageIds.length
    ? await reader.from("packages").select("id, delivery_mode").in("id", packageIds)
    : { data: [] as Array<{ id: string; delivery_mode: string | null }> };
  const delivery = new Map((packageRows ?? []).map((row) => [row.id, row.delivery_mode] as const));
  const oneToOne = visibleInstances.filter((row) => {
    const mode = delivery.get(row.package_id as string);
    return mode == null || mode === "one_to_one";
  });

  const { data: studentPackageRows } = oneToOneIds.length
    ? await reader
        .from("student_packages")
        .select("user_id, package_instance_id, status")
        .in("package_instance_id", oneToOne.map((row) => row.id as string))
        .neq("status", "withdrawn")
    : { data: [] as Array<{ user_id: string; package_instance_id: string }> };

  const { data: enrollmentRows } = await reader
    .from("course_enrollments")
    .select("user_id, course_id, kid_profile_id, delivery_mode")
    .eq("tutor_id", tutorId)
    .or("delivery_mode.is.null,delivery_mode.eq.one_to_one");
  const enrollments = (enrollmentRows ?? []) as Array<{
    user_id: string;
    course_id: string;
    kid_profile_id: string | null;
    delivery_mode: string | null;
  }>;
  const parentIds = [
    ...new Set(
      [...(studentPackageRows ?? []).map((row) => row.user_id), ...enrollments.map((row) => row.user_id)].filter(
        (id): id is string => Boolean(id)
      )
    ),
  ];
  const { data: profiles } = parentIds.length
    ? await reader.from("profiles").select("id, full_name, preferred_name").in("id", parentIds)
    : { data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }> };
  const profileName = new Map(
    (profiles ?? []).map((profile) => [profile.id, getDisplayName(profile) ?? ""] as const)
  );
  const profileFullName = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name?.trim() || getDisplayName(profile) || ""] as const)
  );
  const kidIds = [
    ...new Set((enrollments ?? []).map((row) => row.kid_profile_id).filter((id): id is string => Boolean(id))),
  ];
  const { data: kids } = kidIds.length
    ? await reader.from("kid_profiles").select("id, name").in("id", kidIds)
    : { data: [] as Array<{ id: string; name: string | null }> };
  const kidName = new Map((kids ?? []).map((kid) => [kid.id, kid.name?.trim() ?? ""] as const));

  const courseIds = [
    ...new Set(
      [...visibleCohorts, ...oneToOne]
        .map((row) => row.course_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const [names, lessons] = await Promise.all([
    courseNames(reader, courseIds),
    lessonsByCourse(reader, courseIds),
  ]);

  const cohortIds = visibleCohorts.map((row) => row.id as string);
  const instanceIds = oneToOne.map((row) => row.id as string);
  const [cohortLogResult, packageLogResult] = await Promise.all([
    cohortIds.length
      ? reader
          .from("cohort_lesson_log_entries")
          .select("id, cohort_id, package_instance_id, lesson_id, lesson_date, notes, recording_url, status, dismissed_at, is_cover_session, actual_tutor_id")
          .in("cohort_id", cohortIds)
      : Promise.resolve({ data: [] as LogRow[] }),
    instanceIds.length
      ? reader
          .from("cohort_lesson_log_entries")
          .select("id, cohort_id, package_instance_id, lesson_id, lesson_date, notes, recording_url, status, dismissed_at, is_cover_session, actual_tutor_id")
          .in("package_instance_id", instanceIds)
      : Promise.resolve({ data: [] as LogRow[] }),
  ]);
  const logs = [...(cohortLogResult.data ?? []), ...(packageLogResult.data ?? [])] as LogRow[];

  const peopleByCohort = new Map<string, Person[]>();
  for (const cohort of visibleCohorts) {
    const [roster, kidsInCohort] = await Promise.all([
      loadCohortMembershipRoster(reader, cohort.id as string),
      kidProfileIdsInCohort(reader, cohort.id as string),
    ]);
    peopleByCohort.set(
      cohort.id as string,
      roster
        .filter((student) => student.isActiveMember)
        .map((student) => ({
          id: student.studentId,
          name: student.studentName,
          kind: kidsInCohort.has(student.studentId) ? "kid" : "student",
        }))
    );
  }

  const peopleByPackage = new Map<string, Person[]>();
  for (const instance of oneToOne) {
    const links = (studentPackageRows ?? []).filter((row) => row.package_instance_id === instance.id);
    if (links.length !== 1) continue;
    const parentId = links[0]!.user_id;
    const enrollment = (enrollments ?? []).find(
      (row) =>
        row.user_id === parentId &&
        row.course_id === instance.course_id &&
        row.delivery_mode !== "group"
    );
    const kidProfileId = enrollment?.kid_profile_id ?? null;
    const name = kidProfileId ? kidName.get(kidProfileId) || "" : profileName.get(parentId) || "";
    if (!name) continue;
    peopleByPackage.set(instance.id as string, [
      {
        id: kidProfileId ?? parentId,
        name,
        kind: kidProfileId ? "kid" : "student",
      },
    ]);
  }

  const assignedUserIds = new Set(
    (studentPackageRows ?? [])
      .filter((row) => peopleByPackage.has(row.package_instance_id))
      .map((row) => row.user_id)
  );
  for (const instance of oneToOne) {
    if (peopleByPackage.has(instance.id as string)) continue;
    const matches = enrollments.filter((row) => {
      if (row.course_id !== instance.course_id || row.delivery_mode === "group") return false;
      if (assignedUserIds.has(row.user_id)) return false;
      const studentName = row.kid_profile_id
        ? kidName.get(row.kid_profile_id) || ""
        : profileFullName.get(row.user_id) || "";
      return packageNameMatchesStudent(instance.name as string, studentName);
    });
    if (matches.length !== 1) continue;
    const match = matches[0]!;
    const kidProfileId = match.kid_profile_id;
    const name = kidProfileId ? kidName.get(kidProfileId) || "" : profileName.get(match.user_id) || "";
    if (!name) continue;
    assignedUserIds.add(match.user_id);
    peopleByPackage.set(instance.id as string, [
      { id: kidProfileId ?? match.user_id, name, kind: kidProfileId ? "kid" : "student" },
    ]);
  }

  const loggedLessonIds = [
    ...new Set(logs.filter(countable).map((row) => row.lesson_id).filter((id): id is string => Boolean(id))),
  ];
  const actorIds = [
    ...new Set(
      [...peopleByCohort.values(), ...peopleByPackage.values()].flat().map((person) => person.id)
    ),
  ];
  const studentActorIds = actorIds.filter((id) =>
    [...peopleByCohort.values(), ...peopleByPackage.values()].some((people) =>
      people.some((person) => person.id === id && person.kind === "student")
    )
  );
  const kidActorIds = actorIds.filter((id) =>
    [...peopleByCohort.values(), ...peopleByPackage.values()].some((people) =>
      people.some((person) => person.id === id && person.kind === "kid")
    )
  );
  const [studentSubmissions, kidSubmissions] = await Promise.all([
    loggedLessonIds.length && studentActorIds.length
      ? reader
          .from("homework_submissions")
          .select("lesson_id, student_id, kid_profile_id, is_practice")
          .in("lesson_id", loggedLessonIds)
          .in("student_id", studentActorIds)
          .eq("is_practice", false)
      : Promise.resolve({ data: [] as Array<{ lesson_id: string; student_id: string | null; kid_profile_id: string | null }> }),
    loggedLessonIds.length && kidActorIds.length
      ? reader
          .from("homework_submissions")
          .select("lesson_id, student_id, kid_profile_id, is_practice")
          .in("lesson_id", loggedLessonIds)
          .in("kid_profile_id", kidActorIds)
          .eq("is_practice", false)
      : Promise.resolve({ data: [] as Array<{ lesson_id: string; student_id: string | null; kid_profile_id: string | null }> }),
  ]);
  const submissionRows = [...(studentSubmissions.data ?? []), ...(kidSubmissions.data ?? [])];
  const submitted = new Set(
    (submissionRows ?? [])
      .map((row) => {
        const actor = (row.kid_profile_id as string | null) ?? (row.student_id as string | null);
        return actor ? `${row.lesson_id}:${actor}` : null;
      })
      .filter((key): key is string => Boolean(key))
  );

  function cardFor(options: {
    kind: "group" | "one_to_one";
    id: string;
    name: string;
    courseName: string;
    courseLessons: LessonRow[];
    schedule: string;
    people: Person[];
    classLogs: LogRow[];
    href: string;
  }): TutorClassCard {
    const courseLessons = options.courseLessons;
    const logged = options.classLogs.filter(countable);
    const loggedIds = new Set(logged.map((row) => row.lesson_id as string));
    const next = suggestNextLesson(
      courseLessons.map((lesson) => ({
        lessonId: lesson.id,
        lessonNumber: lesson.lesson_number,
        title: lesson.title,
      })),
      loggedIds
    );
    const missingRecordingNumber = lowestLessonNumber(
      courseLessons.map((lesson) => ({
        lessonNumber: lesson.lesson_number,
        flagged:
          loggedIds.has(lesson.id) &&
          !logged.some((row) => row.lesson_id === lesson.id && row.recording_url?.trim()),
      }))
    );
    const missingHomeworkNumber =
      options.people.length === 0
        ? null
        : lowestLessonNumber(
            courseLessons.map((lesson) => ({
              lessonNumber: lesson.lesson_number,
              flagged:
                loggedIds.has(lesson.id) &&
                options.people.some((person) => !submitted.has(`${lesson.id}:${person.id}`)),
            }))
          );
    return {
      id: options.id,
      kind: options.kind,
      href: options.href,
      name: options.name,
      pill: classTypePill({ kind: options.kind, name: options.name, courseName: options.courseName }),
      schedule: options.schedule,
      loggedCount: loggedIds.size,
      totalLessons: courseLessons.length,
      nextLabel: next ? `Next: ${lessonSlotLabel(options.courseName, next.lessonNumber)} · ${next.title}` : null,
      issue: classIssue({
        courseName: options.courseName,
        missingRecordingNumber,
        missingHomeworkNumber,
      }),
      studentCount: options.people.length,
    };
  }

  const active: TutorClassCard[] = [];
  const finished: TutorClassCard[] = [];

  for (const cohort of visibleCohorts) {
    const teaching = {
      name: cohort.name as string,
      active: cohort.active as boolean | null,
      status: cohort.status as string | null,
    };
    const bucket = isActiveTeachingClass(teaching)
      ? "active"
      : isFinishedTeachingClass(teaching)
        ? "finished"
        : null;
    if (!bucket) continue;
    const courseName = names.get(cohort.course_id as string) ?? "Course";
    const built = cardFor({
      kind: "group",
      id: cohort.id as string,
      name: (cohort.name as string) || "Cohort",
      courseName,
      courseLessons: lessons.get(cohort.course_id as string) ?? [],
      schedule: scheduleLabel(
        cohort.start_day_of_week as string | null,
        cohort.weekly_session_start as string | null
      ),
      people: peopleByCohort.get(cohort.id as string) ?? [],
      classLogs: logs.filter((row) => row.cohort_id === cohort.id),
      href: `/dashboard/tutor/cohort/${cohort.id}`,
    });
    (bucket === "active" ? active : finished).push(built);
  }

  for (const instance of oneToOne) {
    const people = peopleByPackage.get(instance.id as string);
    if (!people) continue;
    const teaching = {
      name: instance.name as string,
      active: instance.active as boolean | null,
      status: instance.status as string | null,
    };
    const bucket = isActiveTeachingClass(teaching)
      ? "active"
      : isFinishedTeachingClass(teaching)
        ? "finished"
        : null;
    if (!bucket) continue;
    const courseName = names.get(instance.course_id as string) ?? "Course";
    const built = cardFor({
      kind: "one_to_one",
      id: instance.id as string,
      name: people[0]!.name,
      courseName,
      courseLessons: lessons.get(instance.course_id as string) ?? [],
      schedule: scheduleLabel(instance.start_day_of_week as string | null, null),
      people,
      classLogs: logs.filter((row) => row.package_instance_id === instance.id),
      href: `/dashboard/tutor/classes/student/${instance.id}`,
    });
    (bucket === "active" ? active : finished).push(built);
  }

  active.sort((a, b) => a.name.localeCompare(b.name));
  finished.sort((a, b) => a.name.localeCompare(b.name));
  const groups = active.filter((row) => row.kind === "group");
  return {
    active,
    finished,
    groupCount: groups.length,
    groupStudentCount: groups.reduce((sum, row) => sum + row.studentCount, 0),
    oneToOneCount: active.filter((row) => row.kind === "one_to_one").length,
  };
}

async function buildDetail(options: {
  reader: SupabaseClient;
  kind: "group" | "one_to_one";
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  schedule: string;
  people: Person[];
  logs: LogRow[];
  logHref: string;
  unlockStudentId: string | null;
  unlockKidProfileId: string | null;
  recordingStudentId: string | null;
  unlockedLessonIds: Set<string>;
}): Promise<ClassDetail> {
  const { data: lessonRows } = await options.reader
    .from("lessons")
    .select("id, course_id, lesson_number, title")
    .eq("course_id", options.courseId);
  const courseLessons = ((lessonRows ?? []) as LessonRow[]).sort(
    (a, b) => a.lesson_number - b.lesson_number
  );
  const logged = options.logs.filter(countable);
  const logByLesson = new Map(logged.map((row) => [row.lesson_id as string, row]));
  const loggedIds = new Set(logByLesson.keys());
  const next = suggestNextLesson(
    courseLessons.map((lesson) => ({
      lessonId: lesson.id,
      lessonNumber: lesson.lesson_number,
      title: lesson.title,
    })),
    loggedIds
  );

  const attendanceQuery = options.kind === "group"
    ? options.reader
        .from("cohort_lesson_attendance")
        .select("lesson_id, attended, student_id, kid_profile_id")
        .eq("cohort_id", options.id)
    : options.reader
        .from("cohort_lesson_attendance")
        .select("lesson_id, attended, student_id, kid_profile_id")
        .eq("package_instance_id", options.id);
  const { data: attendanceRows } = await attendanceQuery;
  const marksByLesson = new Map<string, { present: number; total: number }>();
  const attendedByLessonActor = new Map<string, Map<string, boolean>>();
  for (const row of attendanceRows ?? []) {
    const lessonId = row.lesson_id as string;
    const current = marksByLesson.get(lessonId) ?? { present: 0, total: 0 };
    current.total += 1;
    if (row.attended) current.present += 1;
    marksByLesson.set(lessonId, current);
    const actorId = (row.kid_profile_id as string | null) ?? (row.student_id as string | null);
    if (!actorId) continue;
    const byActor = attendedByLessonActor.get(lessonId) ?? new Map<string, boolean>();
    byActor.set(actorId, Boolean(row.attended));
    attendedByLessonActor.set(lessonId, byActor);
  }

  const lessonIds = courseLessons.map((lesson) => lesson.id);
  const { data: submissionRows } = lessonIds.length
    ? await options.reader
        .from("homework_submissions")
        .select("lesson_id, student_id, kid_profile_id, status, approved, is_practice")
        .in("lesson_id", lessonIds)
        .eq("is_practice", false)
    : { data: [] as Array<Record<string, unknown>> };
  const submissionByLessonActor = new Map<string, { status: string | null; approved: boolean | null }>();
  for (const row of submissionRows ?? []) {
    const actor = (row.kid_profile_id as string | null) ?? (row.student_id as string | null);
    if (!actor) continue;
    submissionByLessonActor.set(`${row.lesson_id}:${actor}`, {
      status: (row.status as string | null) ?? null,
      approved: (row.approved as boolean | null) ?? null,
    });
  }

  const coverTutorIds = [
    ...new Set(
      options.logs
        .map((row) => row.actual_tutor_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: coverProfiles } = coverTutorIds.length
    ? await options.reader
        .from("profiles")
        .select("id, full_name, preferred_name")
        .in("id", coverTutorIds)
    : { data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }> };
  const coverNameById = new Map(
    (coverProfiles ?? []).map((profile) => [profile.id, getDisplayName(profile) ?? ""] as const)
  );

  let unlockEarlyAssigned = false;
  const lessons: ClassLessonRow[] = courseLessons.map((lesson) => {
    const entry = logByLesson.get(lesson.id);
    if (entry) {
      const marks = marksByLesson.get(lesson.id);
      const byActor = attendedByLessonActor.get(lesson.id);
      const person = options.people[0];
      const submission = person ? submissionByLessonActor.get(`${lesson.id}:${person.id}`) : undefined;
      return {
        lessonId: lesson.id,
        lessonNumber: lesson.lesson_number,
        title: lesson.title,
        state: "logged",
        entryId: entry.id,
        dateLabel: entry.lesson_date ? formatTaughtDate(String(entry.lesson_date).slice(0, 10)) : null,
        present: marks?.present ?? 0,
        total: marks?.total ?? options.people.length,
        hasRecording: Boolean(entry.recording_url?.trim()),
        notes: entry.notes?.trim() || null,
        homeworkLabel:
          options.kind === "one_to_one"
            ? homeworkLabel(submission?.status ?? null, submission?.approved ?? null)
            : null,
        unlockEarly: false,
        coverLabel: entry.is_cover_session
          ? coverTaughtByLabel(entry.actual_tutor_id ? coverNameById.get(entry.actual_tutor_id) : null)
          : null,
        recordingUrl: entry.recording_url?.trim() ?? "",
        isCoverSession: Boolean(entry.is_cover_session),
        actualTutorId: entry.actual_tutor_id ?? null,
        attendance: options.people.map((student) => ({
          id: student.id,
          name: student.name,
          kind: student.kind,
          attended: byActor?.get(student.id) ?? (byActor && byActor.size > 0 ? false : true),
        })),
      };
    }
    if (next?.lessonId === lesson.id) {
      return {
        lessonId: lesson.id,
        lessonNumber: lesson.lesson_number,
        title: lesson.title,
        state: "next",
        entryId: null,
        dateLabel: null,
        present: 0,
        total: options.people.length,
        hasRecording: false,
        notes: null,
        homeworkLabel: null,
        unlockEarly: false,
        coverLabel: null,
        recordingUrl: "",
        isCoverSession: false,
        actualTutorId: null,
        attendance: [],
      };
    }
    const alreadyUnlocked = options.unlockedLessonIds.has(lesson.id);
    const unlockEarly = !alreadyUnlocked && !unlockEarlyAssigned;
    if (unlockEarly) unlockEarlyAssigned = true;
    return {
      lessonId: lesson.id,
      lessonNumber: lesson.lesson_number,
      title: lesson.title,
      state: "future",
      entryId: null,
      dateLabel: null,
      present: 0,
      total: options.people.length,
      hasRecording: false,
      notes: null,
      homeworkLabel: null,
      unlockEarly,
      coverLabel: null,
      recordingUrl: "",
      isCoverSession: false,
      actualTutorId: null,
      attendance: [],
    };
  });

  const latest = [...logged].sort((a, b) => (b.lesson_date ?? "").localeCompare(a.lesson_date ?? ""))[0];
  const latestLesson = latest?.lesson_id
    ? courseLessons.find((lesson) => lesson.id === latest.lesson_id)
    : null;
  const pinned =
    latest?.notes?.trim() && latestLesson
      ? { lessonNumber: latestLesson.lesson_number, notes: latest.notes.trim() }
      : null;

  let present = 0;
  let marked = 0;
  for (const lessonId of loggedIds) {
    const marks = marksByLesson.get(lessonId);
    if (!marks) continue;
    present += marks.present;
    marked += marks.total;
  }
  const recordingsMissing = logged.filter((row) => !row.recording_url?.trim()).length;

  return {
    kind: options.kind,
    name: options.name,
    courseName: options.courseName,
    courseId: options.courseId,
    schedule: options.schedule,
    loggedCount: loggedIds.size,
    totalLessons: courseLessons.length,
    attendancePercent: marked === 0 ? null : Math.round((present / marked) * 100),
    recordingsMissing,
    pinned,
    lessons,
    students: options.people.map((person) => ({ id: person.id, name: person.name })),
    logHref: options.logHref,
    unlockStudentId: options.unlockStudentId,
    unlockKidProfileId: options.unlockKidProfileId,
    recordingStudentId: options.recordingStudentId,
  };
}

export async function loadCohortClassDetail(
  reader: SupabaseClient,
  tutorId: string,
  cohortId: string
): Promise<ClassDetail | null> {
  const { data: cohort } = await reader
    .from("cohorts")
    .select("id, name, status, active, course_id, tutor_id, start_day_of_week, weekly_session_start, courses(name)")
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort || cohort.tutor_id !== tutorId) return null;
  const teaching = {
    name: cohort.name as string,
    active: cohort.active as boolean | null,
    status: cohort.status as string | null,
  };
  if (isTestClassName(teaching.name) || (!isActiveTeachingClass(teaching) && !isFinishedTeachingClass(teaching))) {
    return null;
  }
  const course = Array.isArray(cohort.courses) ? cohort.courses[0] : cohort.courses;
  const courseName = (course as { name?: string } | null)?.name ?? "Course";
  const [roster, kidsInCohort, { data: logRows }] = await Promise.all([
    loadCohortMembershipRoster(reader, cohortId),
    kidProfileIdsInCohort(reader, cohortId),
    reader
      .from("cohort_lesson_log_entries")
      .select("id, cohort_id, package_instance_id, lesson_id, lesson_date, notes, recording_url, status, dismissed_at, is_cover_session, actual_tutor_id")
      .eq("cohort_id", cohortId),
  ]);
  const people: Person[] = roster
    .filter((student) => student.isActiveMember)
    .map((student) => ({
      id: student.studentId,
      name: student.studentName,
      kind: kidsInCohort.has(student.studentId) ? "kid" : "student",
    }));
  const { data: unlockRows } = await reader
    .from("cohort_lesson_unlocks")
    .select("lesson_id")
    .eq("cohort_id", cohortId);
  return buildDetail({
    reader,
    kind: "group",
    id: cohortId,
    name: (cohort.name as string) || "Cohort",
    courseId: cohort.course_id as string,
    courseName,
    schedule: scheduleLabel(
      cohort.start_day_of_week as string | null,
      cohort.weekly_session_start as string | null
    ),
    people,
    logs: (logRows ?? []) as LogRow[],
    logHref: `/dashboard/tutor/log?cohort=${cohortId}`,
    unlockStudentId: null,
    unlockKidProfileId: null,
    recordingStudentId: null,
    unlockedLessonIds: new Set((unlockRows ?? []).map((row) => row.lesson_id as string)),
  });
}

export async function loadPackageClassDetail(
  reader: SupabaseClient,
  tutorId: string,
  packageInstanceId: string
): Promise<ClassDetail | null> {
  const { data: instance } = await reader
    .from("package_instances")
    .select("id, name, status, active, course_id, tutor_id, start_day_of_week, package_id, courses(name)")
    .eq("id", packageInstanceId)
    .maybeSingle();
  if (!instance || instance.tutor_id !== tutorId) return null;
  const teaching = {
    name: instance.name as string,
    active: instance.active as boolean | null,
    status: instance.status as string | null,
  };
  if (isTestClassName(teaching.name) || (!isActiveTeachingClass(teaching) && !isFinishedTeachingClass(teaching))) {
    return null;
  }
  const { data: links } = await reader
    .from("student_packages")
    .select("user_id")
    .eq("package_instance_id", packageInstanceId)
    .neq("status", "withdrawn");
  let parentId = (links ?? []).length === 1 ? ((links?.[0]?.user_id as string | null) ?? null) : null;
  if (!parentId) {
    const { data: courseEnrollments } = await reader
      .from("course_enrollments")
      .select("user_id, kid_profile_id, delivery_mode, profiles(full_name, preferred_name)")
      .eq("tutor_id", tutorId)
      .eq("course_id", instance.course_id)
      .or("delivery_mode.is.null,delivery_mode.eq.one_to_one");
    const matches = (courseEnrollments ?? []).filter((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const studentName =
        (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
        getDisplayName(profile as { full_name?: string | null; preferred_name?: string | null } | null) ||
        "";
      return packageNameMatchesStudent(instance.name as string, studentName);
    });
    if (matches.length === 1) parentId = (matches[0]?.user_id as string | null) ?? null;
  }
  if (!parentId) return null;
  const [{ data: profile }, { data: enrollment }, { data: logRows }] = await Promise.all([
    reader.from("profiles").select("id, full_name, preferred_name").eq("id", parentId).maybeSingle(),
    reader
      .from("course_enrollments")
      .select("kid_profile_id, delivery_mode")
      .eq("user_id", parentId)
      .eq("course_id", instance.course_id)
      .eq("tutor_id", tutorId)
      .maybeSingle(),
    reader
      .from("cohort_lesson_log_entries")
      .select("id, cohort_id, package_instance_id, lesson_id, lesson_date, notes, recording_url, status, dismissed_at, is_cover_session, actual_tutor_id")
      .eq("package_instance_id", packageInstanceId),
  ]);
  const kidProfileId =
    enrollment && enrollment.delivery_mode !== "group"
      ? ((enrollment.kid_profile_id as string | null) ?? null)
      : null;
  let name = kidProfileId ? "" : getDisplayName(profile) ?? "";
  if (kidProfileId) {
    const { data: kid } = await reader.from("kid_profiles").select("name").eq("id", kidProfileId).maybeSingle();
    name = kid?.name?.trim() ?? "";
  }
  if (!name) return null;
  const course = Array.isArray(instance.courses) ? instance.courses[0] : instance.courses;
  const courseName = (course as { name?: string } | null)?.name ?? "Course";
  const unlockQuery = kidProfileId
    ? reader.from("student_lesson_unlocks").select("lesson_id").eq("kid_profile_id", kidProfileId)
    : reader.from("student_lesson_unlocks").select("lesson_id").eq("student_id", parentId);
  const { data: unlockRows } = await unlockQuery;
  return buildDetail({
    reader,
    kind: "one_to_one",
    id: packageInstanceId,
    name,
    courseId: instance.course_id as string,
    courseName,
    schedule: scheduleLabel(instance.start_day_of_week as string | null, null),
    people: [{ id: kidProfileId ?? parentId, name, kind: kidProfileId ? "kid" : "student" }],
    logs: (logRows ?? []) as LogRow[],
    logHref: `/dashboard/tutor/log?student=${packageInstanceId}`,
    unlockStudentId: kidProfileId ? null : parentId,
    unlockKidProfileId: kidProfileId,
    recordingStudentId: parentId,
    unlockedLessonIds: new Set((unlockRows ?? []).map((row) => row.lesson_id as string)),
  });
}

export function attentionItems(cards: TutorClassCard[]): TutorClassCard[] {
  return cards.filter((card) => card.issue.tone !== "green");
}
