import { slugifyCourseName } from "@/lib/lessons/slugify-course-name";

export const LESSON_AUDIO_BUCKET = "lesson-audio" as const;

/** Collision-resistant path: `{course-slug}/{lesson-id}.mp3` */
export function lessonAudioStoragePath(courseName: string, lessonId: string): string {
  return `${slugifyCourseName(courseName)}/${lessonId}.mp3`;
}

export function publicUrlForLessonAudioPath(
  supabaseUrl: string,
  storagePath: string
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const encoded = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/${LESSON_AUDIO_BUCKET}/${encoded}`;
}
