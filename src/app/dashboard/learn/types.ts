import type { LessonPracticeLinks } from "@/lib/learning/match-lesson-content";

export type LessonWithCourse = {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  audio_url: string | null;
  is_free: boolean;
  courses: { name: string } | null;
  practice: LessonPracticeLinks;
};

export type CourseWithLessons = {
  id: string;
  name: string;
  required_tier?: string | null;
  lessons: LessonWithCourse[];
};
