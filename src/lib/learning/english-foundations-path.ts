import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseRecord } from "@/lib/membership/courses";
import { LEARN_ENGLISH_CONTENT_TRACK } from "@/lib/learning/private-courses";
import {
  fetchLessonCompletionMap,
  type LessonCompletionStatus,
} from "@/lib/progress/lesson-completion";
import {
  fetchLessonProgressMap,
  type LessonProgressRow,
} from "@/lib/progress/lesson-progress";

export type EnglishFoundationsPathStatus = "complete" | "active" | "locked";

export type EnglishFoundationsPathItem = {
  id: string;
  title: string;
  lessonNumber: number;
  sortIndex: number;
  status: EnglishFoundationsPathStatus;
};

export type LearnEnglishHomeCourse = CourseRecord & {
  content_track: string | null;
  is_home_course: boolean | null;
};

/**
 * The single Home pathway course (English Foundations today).
 * Tagged `content_track = learn_english` + `is_home_course = true`.
 */
export async function fetchLearnEnglishHomeCourse(
  supabase: SupabaseClient,
  userId: string
): Promise<LearnEnglishHomeCourse | null> {
  const { data: accessRows, error: accessError } = await supabase
    .from("course_access")
    .select("course_id")
    .eq("user_id", userId);

  if (accessError || !accessRows?.length) return null;

  const courseIds = accessRows.map((row) => row.course_id as string);
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, name, required_tier, is_public, content_track, is_home_course")
    .in("id", courseIds)
    .eq("content_track", LEARN_ENGLISH_CONTENT_TRACK)
    .eq("is_home_course", true)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !course) return null;

  return {
    id: course.id as string,
    name: course.name as string,
    required_tier: (course.required_tier as string | null) ?? null,
    is_public: (course.is_public as boolean | null) ?? null,
    content_track: (course.content_track as string | null) ?? null,
    is_home_course: (course.is_home_course as boolean | null) ?? null,
  };
}

/**
 * Same sequence idea as Everyday Punjabi path (previous node must be complete),
 * but completion is regular lesson completion — not topic_mastery.
 *
 * - Flashcard/quiz lessons: `fullyComplete`
 * - Audio-only / no scored parts: `lesson_progress.completed`
 */
export function isEnglishFoundationsLessonComplete(
  completion: LessonCompletionStatus | undefined,
  progress: LessonProgressRow | undefined
): boolean {
  if (completion && completion.partsTotal > 0) {
    return completion.fullyComplete;
  }
  return Boolean(progress?.completed);
}

/**
 * Data-driven path: one node per lesson row for the home course, ordered by lesson_number.
 * Adding more lessons in Supabase grows the path automatically — no hardcoded count.
 */
export async function loadEnglishFoundationsPathItems(
  supabase: SupabaseClient,
  userId: string,
  courseId: string
): Promise<EnglishFoundationsPathItem[]> {
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, title, lesson_number, course_id, pdf_url, audio_url")
    .eq("course_id", courseId)
    .order("lesson_number", { ascending: true });

  if (error || !lessons?.length) return [];

  const ordered = [...lessons].sort(
    (a, b) => (a.lesson_number as number) - (b.lesson_number as number)
  );

  const lessonRefs = ordered.map((lesson) => ({
    id: lesson.id as string,
    title: lesson.title as string,
    course_id: lesson.course_id as string,
    lesson_number: lesson.lesson_number as number,
    pdf_url: (lesson.pdf_url as string | null) ?? null,
    audio_url: (lesson.audio_url as string | null) ?? null,
  }));

  const [completionMap, progressMap] = await Promise.all([
    fetchLessonCompletionMap(supabase, userId, lessonRefs),
    fetchLessonProgressMap(supabase, userId),
  ]);

  const completeFlags = lessonRefs.map((lesson) =>
    isEnglishFoundationsLessonComplete(
      completionMap.get(lesson.id),
      progressMap.get(lesson.id)
    )
  );

  return lessonRefs.map((lesson, index) => {
    const complete = completeFlags[index] ?? false;
    const previousComplete = index === 0 ? true : Boolean(completeFlags[index - 1]);
    const unlocked = previousComplete;

    let status: EnglishFoundationsPathStatus;
    if (!unlocked) {
      status = "locked";
    } else if (complete) {
      status = "complete";
    } else {
      status = "active";
    }

    // Only the first incomplete unlocked node is "active"; later unlocked
    // incompletes shouldn't exist under strict sequence, but keep locked-safe.
    if (status === "active") {
      const earlierActiveExists = completeFlags
        .slice(0, index)
        .some((done, i) => {
          const prevOk = i === 0 ? true : Boolean(completeFlags[i - 1]);
          return prevOk && !done;
        });
      if (earlierActiveExists) status = "locked";
    }

    return {
      id: lesson.id,
      title: lesson.title,
      lessonNumber: lesson.lesson_number,
      sortIndex: index,
      status,
    };
  });
}
