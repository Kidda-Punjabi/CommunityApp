import "server-only";

import { isCountableLessonLogStatus } from "@/lib/lessons/lesson-log-progress";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { getHomeworkTimingState } from "@/lib/tutoring/homework-near-lesson";
import type { KidProfile } from "@/lib/kids/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ParentKidHomeworkUiStatus =
  | "submitted"
  | "late"
  | "missed"
  | "not_due_yet";

export type ParentKidAttendanceUiStatus = "present" | "absent" | "upcoming";

export type ParentKidLessonProgress = {
  lessonId: string;
  lessonNumber: number;
  lessonTitle: string;
  homeworkStatus: "not_submitted" | "pending_review" | "reviewed";
  homeworkTiming: "on_time" | "late" | "post_lesson" | "unknown" | null;
  homeworkUiStatus: ParentKidHomeworkUiStatus;
  tutorComment: string | null;
  attended: boolean | null;
  attendanceNote: string | null;
  attendanceUiStatus: ParentKidAttendanceUiStatus;
  unlocked: boolean;
  happened: boolean;
  weekTutorNote: string | null;
};

export type ParentKidCourseSummary = {
  courseId: string;
  courseName: string;
  currentWeek: number;
  totalWeeks: number;
  homeworkDone: number;
  homeworkDue: number;
  attendancePresent: number;
  attendanceDue: number;
  tutorNoteCount: number;
  lessons: ParentKidLessonProgress[];
};

export type ParentKidCourseProgress = {
  profile: KidProfile;
  courses: ParentKidCourseSummary[];
};

function trimNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function homeworkUiStatus(
  hasSubmission: boolean,
  timing: ParentKidLessonProgress["homeworkTiming"],
  due: boolean
): ParentKidHomeworkUiStatus {
  if (hasSubmission) {
    if (timing === "late" || timing === "post_lesson") return "late";
    return "submitted";
  }
  if (!due) return "not_due_yet";
  return "missed";
}

function attendanceUiStatus(attended: boolean | null): ParentKidAttendanceUiStatus {
  if (attended === true) return "present";
  if (attended === false) return "absent";
  return "upcoming";
}

function weekTutorNote(homeworkComment: string | null, attendanceNote: string | null): string | null {
  if (attendanceNote && homeworkComment && attendanceNote !== homeworkComment) {
    return `${attendanceNote}\n\nHomework: ${homeworkComment}`;
  }
  return attendanceNote ?? homeworkComment;
}

/**
 * Parent-context unlock lookup.
 *
 * Adult Learn uses `is_lesson_content_unlocked(parent_user_id, lesson_id)`, which
 * reads the *active* kid session. That RPC cannot be reused here: the parent is
 * viewing every child at once, with no kid switched in.
 *
 * Same tables the RPC uses, queried by this child's `kid_profile_id` / cohort:
 * group → `cohort_lesson_unlocks`; 1:1 → `student_lesson_unlocks`.
 * Past `cohort_lesson_log_entries` (same denominator as adult cohort stats)
 * mark lessons that have already happened.
 */
function unlockQueryClient(userClient: SupabaseClient): SupabaseClient {
  const admin = tryCreateServiceRoleClient();
  return admin.client ?? userClient;
}

export async function loadParentKidsCourseProgress(
  supabase: SupabaseClient,
  parentUserId: string,
  profiles: KidProfile[]
): Promise<ParentKidCourseProgress[]> {
  if (profiles.length === 0) return [];

  const unlockDb = unlockQueryClient(supabase);
  const results: ParentKidCourseProgress[] = [];

  for (const profile of profiles) {
    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("course_id, cohort_id, delivery_mode, courses(name)")
      .eq("kid_profile_id", profile.id);

    const enrollmentRows = enrollments ?? [];
    const groupCohortIds = [
      ...new Set(
        enrollmentRows
          .map((row) => row.cohort_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const today = new Date().toISOString().slice(0, 10);
    const [{ data: cohortUnlockRows }, { data: studentUnlockRows }, { data: logRows }] =
      await Promise.all([
        groupCohortIds.length
          ? unlockDb
              .from("cohort_lesson_unlocks")
              .select("cohort_id, lesson_id")
              .in("cohort_id", groupCohortIds)
          : Promise.resolve({ data: [] as never[] }),
        supabase
          .from("student_lesson_unlocks")
          .select("lesson_id")
          .eq("kid_profile_id", profile.id),
        groupCohortIds.length
          ? unlockDb
              .from("cohort_lesson_log_entries")
              .select("cohort_id, lesson_id, lesson_date, status")
              .in("cohort_id", groupCohortIds)
              .not("lesson_id", "is", null)
              .lte("lesson_date", today)
          : Promise.resolve({ data: [] as never[] }),
      ]);

    const unlockedByCohort = new Map<string, Set<string>>();
    for (const row of cohortUnlockRows ?? []) {
      const cohortId = row.cohort_id as string;
      const lessonId = row.lesson_id as string;
      if (!cohortId || !lessonId) continue;
      const set = unlockedByCohort.get(cohortId) ?? new Set<string>();
      set.add(lessonId);
      unlockedByCohort.set(cohortId, set);
    }

    const oneToOneUnlocked = new Set(
      (studentUnlockRows ?? [])
        .map((row) => row.lesson_id as string)
        .filter(Boolean)
    );

    const happenedByCohort = new Map<string, Set<string>>();
    for (const row of logRows ?? []) {
      if (!isCountableLessonLogStatus(row.status as string | null)) continue;
      const cohortId = row.cohort_id as string;
      const lessonId = row.lesson_id as string;
      if (!cohortId || !lessonId) continue;
      const set = happenedByCohort.get(cohortId) ?? new Set<string>();
      set.add(lessonId);
      happenedByCohort.set(cohortId, set);
    }

    const courses: ParentKidCourseSummary[] = [];

    for (const enrollment of enrollmentRows) {
      const courseId = enrollment.course_id as string;
      const cohortId = (enrollment.cohort_id as string | null) ?? null;
      const deliveryMode = enrollment.delivery_mode as string | null;
      const courseRel = enrollment.courses as
        | { name: string }
        | { name: string }[]
        | null;
      const courseName = Array.isArray(courseRel)
        ? courseRel[0]?.name
        : courseRel?.name;
      if (!courseId || !courseName) continue;

      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, lesson_number")
        .eq("course_id", courseId)
        .order("lesson_number");

      const lessonIds = (lessons ?? []).map((row) => row.id as string);
      const [{ data: homeworkRows }, { data: attendanceRows }] = await Promise.all([
        lessonIds.length
          ? supabase
              .from("homework_submissions")
              .select("lesson_id, status, tutor_comment, submitted_at")
              .eq("kid_profile_id", profile.id)
              .eq("is_practice", false)
              .in("lesson_id", lessonIds)
          : Promise.resolve({ data: [] as never[] }),
        lessonIds.length
          ? supabase
              .from("cohort_lesson_attendance")
              .select("lesson_id, attended, tutor_note")
              .eq("kid_profile_id", profile.id)
              .in("lesson_id", lessonIds)
          : Promise.resolve({ data: [] as never[] }),
      ]);

      const homeworkByLesson = new Map(
        (homeworkRows ?? []).map((row) => [row.lesson_id as string, row])
      );
      const attendanceByLesson = new Map(
        (attendanceRows ?? []).map((row) => [row.lesson_id as string, row])
      );

      const groupUnlocked = cohortId ? unlockedByCohort.get(cohortId) : undefined;
      const happened = cohortId ? happenedByCohort.get(cohortId) : undefined;

      const timingEntries = await Promise.all(
        (lessons ?? []).map(async (lesson) => {
          const homework = homeworkByLesson.get(lesson.id as string);
          if (!homework?.submitted_at) return [lesson.id as string, null] as const;
          const timing = await getHomeworkTimingState(
            supabase,
            parentUserId,
            lesson.id as string,
            new Date(),
            profile.id
          );
          return [lesson.id as string, timing] as const;
        })
      );
      const timingByLesson = new Map(timingEntries);

      const lessonProgress: ParentKidLessonProgress[] = [];
      for (const lesson of lessons ?? []) {
        const lessonId = lesson.id as string;
        const homework = homeworkByLesson.get(lessonId);
        const attendance = attendanceByLesson.get(lessonId);
        const homeworkTiming = timingByLesson.get(lessonId) ?? null;
        const unlocked =
          deliveryMode === "group"
            ? Boolean(groupUnlocked?.has(lessonId))
            : oneToOneUnlocked.has(lessonId);
        const lessonHappened = Boolean(happened?.has(lessonId)) || unlocked;
        const tutorComment = trimNote(homework?.tutor_comment);
        const attendanceNote = trimNote(attendance?.tutor_note);
        const attended =
          typeof attendance?.attended === "boolean" ? attendance.attended : null;

        lessonProgress.push({
          lessonId,
          lessonNumber: Number(lesson.lesson_number),
          lessonTitle: String(lesson.title ?? "Lesson"),
          homeworkStatus: homework
            ? ((homework.status as ParentKidLessonProgress["homeworkStatus"]) ??
              "pending_review")
            : "not_submitted",
          homeworkTiming,
          homeworkUiStatus: homeworkUiStatus(
            Boolean(homework),
            homeworkTiming,
            lessonHappened
          ),
          tutorComment,
          attended,
          attendanceNote,
          attendanceUiStatus: attendanceUiStatus(attended),
          unlocked,
          happened: lessonHappened,
          weekTutorNote: weekTutorNote(tutorComment, attendanceNote),
        });
      }

      const unlockedNumbers = lessonProgress
        .filter((lesson) => lesson.unlocked)
        .map((lesson) => lesson.lessonNumber);
      const happenedNumbers = lessonProgress
        .filter((lesson) => lesson.happened)
        .map((lesson) => lesson.lessonNumber);
      const currentWeek = Math.max(
        0,
        ...(unlockedNumbers.length > 0 ? unlockedNumbers : happenedNumbers)
      );
      const dueLessons = lessonProgress.filter((lesson) => lesson.happened);

      courses.push({
        courseId,
        courseName,
        currentWeek,
        totalWeeks: lessonProgress.length,
        homeworkDone: dueLessons.filter((lesson) => lesson.homeworkStatus !== "not_submitted")
          .length,
        homeworkDue: dueLessons.length,
        attendancePresent: dueLessons.filter((lesson) => lesson.attended === true).length,
        attendanceDue: dueLessons.length,
        tutorNoteCount: lessonProgress.filter((lesson) => lesson.weekTutorNote).length,
        lessons: lessonProgress,
      });
    }

    results.push({ profile, courses });
  }

  return results;
}
