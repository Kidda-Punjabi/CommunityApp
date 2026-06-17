import { createClient } from "@/lib/supabase/server";
import { LessonCard } from "@/components/lesson-card";
import {
  getLessonPracticeLinks,
  type FlashcardRow,
  type QuizRow,
} from "@/lib/learning/match-lesson-content";
import type { CourseWithLessons, LessonWithCourse } from "./types";

function groupLessonsByCourse(
  courses: { id: string; name: string; display_order: number }[],
  lessons: LessonWithCourse[]
): CourseWithLessons[] {
  const grouped = new Map<string, CourseWithLessons>();

  for (const course of courses) {
    grouped.set(course.id, { id: course.id, name: course.name, lessons: [] });
  }

  for (const lesson of lessons) {
    const course = grouped.get(lesson.course_id);
    if (course) {
      course.lessons.push(lesson);
    }
  }

  return Array.from(grouped.values()).filter((course) => course.lessons.length > 0);
}

export default async function LearnPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: courses, error: coursesError },
    { data: lessons, error: lessonsError },
    { data: quizzes },
    { data: flashcards },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("membership_tier")
      .eq("id", user!.id)
      .single(),
    supabase.from("courses").select("id, name, display_order").order("display_order"),
    supabase
      .from("lessons")
      .select("id, course_id, lesson_number, title, audio_url, is_free, courses(name)")
      .order("lesson_number"),
    supabase
      .from("quizzes")
      .select("id, course_id, level_number, title"),
    supabase
      .from("flashcards")
      .select("id, lesson_id, deck_name, front_text, back_text"),
  ]);

  const membershipTier = profile?.membership_tier ?? "free";
  const isPaidMember = membershipTier !== "free";

  const quizRows = (quizzes ?? []) as QuizRow[];
  const flashcardRows = (flashcards ?? []) as FlashcardRow[];

  const normalizedLessons: LessonWithCourse[] = (lessons ?? []).map((lesson) => {
    const course = Array.isArray(lesson.courses)
      ? lesson.courses[0]
      : lesson.courses;

    const base = {
      id: lesson.id,
      course_id: lesson.course_id,
      lesson_number: lesson.lesson_number,
      title: lesson.title,
      audio_url: lesson.audio_url,
      is_free: lesson.is_free,
      courses: course ? { name: course.name } : null,
    };

    return {
      ...base,
      practice: getLessonPracticeLinks(base, quizRows, flashcardRows),
    };
  });

  const courseGroups = groupLessonsByCourse(courses ?? [], normalizedLessons);
  const totalLessons = lessons?.length ?? 0;

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {totalLessons > 0
            ? `${totalLessons} lesson${totalLessons === 1 ? "" : "s"} available`
            : "Lessons will appear here once added in admin."}
        </p>
      </div>

      {(coursesError || lessonsError) && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {coursesError?.message || lessonsError?.message}
        </p>
      )}

      {courseGroups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <span className="text-5xl" role="img" aria-hidden="true">
            📚
          </span>
          <p className="mt-4 text-lg font-semibold text-zinc-900">No lessons yet</p>
          <p className="mt-2 text-sm text-zinc-500">
            Add lessons in the admin panel and they will show up here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {courseGroups.map((course) => (
            <section key={course.id}>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">{course.name}</h2>
              <div className="space-y-3">
                {course.lessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    canAccess={lesson.is_free || isPaidMember}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
