import "server-only";

import { getHomeworkTimingState } from "@/lib/tutoring/homework-near-lesson";
import type { KidProfile } from "@/lib/kids/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ParentKidLessonProgress = {
  lessonId: string;
  lessonNumber: number;
  lessonTitle: string;
  homeworkStatus: "not_submitted" | "pending_review" | "reviewed";
  homeworkTiming: "on_time" | "late" | "post_lesson" | "unknown" | null;
  tutorComment: string | null;
  attended: boolean | null;
  attendanceNote: string | null;
};

export type ParentKidCourseProgress = {
  profile: KidProfile;
  courses: Array<{
    courseId: string;
    courseName: string;
    lessons: ParentKidLessonProgress[];
  }>;
};

export async function loadParentKidsCourseProgress(
  supabase: SupabaseClient,
  parentUserId: string,
  profiles: KidProfile[]
): Promise<ParentKidCourseProgress[]> {
  if (profiles.length === 0) return [];

  const results: ParentKidCourseProgress[] = [];

  for (const profile of profiles) {
    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("course_id, courses(name)")
      .eq("kid_profile_id", profile.id);

    const courses: ParentKidCourseProgress["courses"] = [];

    for (const enrollment of enrollments ?? []) {
      const courseId = enrollment.course_id as string;
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

      const lessonProgress: ParentKidLessonProgress[] = [];
      for (const lesson of lessons ?? []) {
        const homework = homeworkByLesson.get(lesson.id as string);
        let homeworkTiming: ParentKidLessonProgress["homeworkTiming"] = null;
        if (homework?.submitted_at) {
          homeworkTiming = await getHomeworkTimingState(
            supabase,
            parentUserId,
            lesson.id as string,
            new Date(),
            profile.id
          );
        }
        const attendance = attendanceByLesson.get(lesson.id as string);
        lessonProgress.push({
          lessonId: lesson.id as string,
          lessonNumber: Number(lesson.lesson_number),
          lessonTitle: String(lesson.title ?? "Lesson"),
          homeworkStatus: homework
            ? ((homework.status as ParentKidLessonProgress["homeworkStatus"]) ??
              "pending_review")
            : "not_submitted",
          homeworkTiming,
          tutorComment: (homework?.tutor_comment as string | null) ?? null,
          attended:
            typeof attendance?.attended === "boolean" ? attendance.attended : null,
          attendanceNote: (attendance?.tutor_note as string | null) ?? null,
        });
      }

      courses.push({ courseId, courseName, lessons: lessonProgress });
    }

    results.push({ profile, courses });
  }

  return results;
}
