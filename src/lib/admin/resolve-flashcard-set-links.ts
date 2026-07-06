import type { FlashcardSetCourseAssociation } from "@/app/admin/content/types";

const TIER_BY_ASSOCIATION: Record<
  Exclude<FlashcardSetCourseAssociation, "uncategorized">,
  string
> = {
  foundations: "foundational",
  beginners: "beginners",
  community: "community",
};

export type CourseLessonLookup = {
  coursesByTier: Map<string, string>;
  lessonsByCourseAndNumber: Map<string, string>;
};

export function lessonMapKey(courseId: string, lessonNumber: number): string {
  return `${courseId}:${lessonNumber}`;
}

export function buildCourseLessonLookup(
  courses: Array<{ id: string; required_tier?: string | null }>,
  lessons: Array<{ id: string; course_id: string; lesson_number: number }>
): CourseLessonLookup {
  const coursesByTier = new Map<string, string>();
  for (const course of courses) {
    if (course.required_tier) {
      coursesByTier.set(course.required_tier, course.id);
    }
  }

  const lessonsByCourseAndNumber = new Map<string, string>();
  for (const lesson of lessons) {
    lessonsByCourseAndNumber.set(
      lessonMapKey(lesson.course_id, lesson.lesson_number),
      lesson.id
    );
  }

  return { coursesByTier, lessonsByCourseAndNumber };
}

/** Infer lesson week from FC / Foundations L naming when week_number is unset. */
export function inferWeekNumberFromSetName(
  name: string,
  association: FlashcardSetCourseAssociation
): number | null {
  if (association === "foundations") {
    const fcMatch = name.match(/^FC\s*-?\s*Set\s*(\d+)/i);
    if (fcMatch) {
      const week = parseInt(fcMatch[1], 10);
      return week >= 1 && week <= 12 ? week : null;
    }
    const foundationsLesson = name.match(/^Foundations\s+L(\d+)/i);
    if (foundationsLesson) {
      const week = parseInt(foundationsLesson[1], 10);
      return week >= 1 && week <= 12 ? week : null;
    }
  }

  if (association === "beginners") {
    const weekMatch = name.match(/^Week\s+(\d+)/i);
    if (weekMatch) {
      const week = parseInt(weekMatch[1], 10);
      return week >= 1 && week <= 12 ? week : null;
    }
    const vocabWeek = name.match(/^Vocabulary\s+-\s+Week\s+(\d+)/i);
    if (vocabWeek) {
      const week = parseInt(vocabWeek[1], 10);
      return week >= 1 && week <= 12 ? week : null;
    }
  }

  if (association === "community") {
    const communityWeek = name.match(/^Week\s+(\d+)\s+-/i);
    if (communityWeek) {
      const week = parseInt(communityWeek[1], 10);
      return week >= 1 && week <= 24 ? week : null;
    }
  }

  return null;
}

export function resolveFlashcardSetLinks(
  lookup: CourseLessonLookup,
  association: FlashcardSetCourseAssociation,
  weekNumber: number | null,
  setName: string
): { courseIds: string[]; lessonIds: string[] } {
  if (association === "uncategorized") {
    return { courseIds: [], lessonIds: [] };
  }

  const tier = TIER_BY_ASSOCIATION[association];
  const courseId = lookup.coursesByTier.get(tier);
  if (!courseId) {
    return { courseIds: [], lessonIds: [] };
  }

  const week =
    weekNumber ?? inferWeekNumberFromSetName(setName, association);

  if (week === null) {
    return { courseIds: [courseId], lessonIds: [] };
  }

  const lessonId = lookup.lessonsByCourseAndNumber.get(
    lessonMapKey(courseId, week)
  );

  return {
    courseIds: [courseId],
    lessonIds: lessonId ? [lessonId] : [],
  };
}

export function describeFlashcardSetLinks(
  association: FlashcardSetCourseAssociation,
  weekNumber: number | null,
  setName: string,
  courses: Array<{ id: string; name: string; required_tier?: string | null }>,
  lessons: Array<{
    id: string;
    course_id: string;
    lesson_number: number;
    title: string;
  }>
): string {
  const lookup = buildCourseLessonLookup(courses, lessons);
  const { courseIds, lessonIds } = resolveFlashcardSetLinks(
    lookup,
    association,
    weekNumber,
    setName
  );

  if (courseIds.length === 0) {
    return "Not linked to a course — choose a course category above.";
  }

  const course = courses.find((c) => c.id === courseIds[0]);
  const parts = [course?.name ?? "Course"];

  if (lessonIds.length > 0) {
    const lesson = lessons.find((l) => l.id === lessonIds[0]);
    if (lesson) {
      parts.push(`Lesson ${lesson.lesson_number}: ${lesson.title}`);
    }
  } else {
    parts.push("course-wide (no specific lesson)");
  }

  return parts.join(" · ");
}
