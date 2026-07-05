import {
  isCommunityCourseLesson,
  isLessonContentUnlockedForUser,
} from "@/lib/learning/learn-access";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import type { CourseAccessContext } from "@/lib/membership/unlocked";
import type { SupabaseClient } from "@supabase/supabase-js";

type LessonUnlockRef = {
  id: string;
  course_id: string;
  is_free: boolean;
};

export type LessonRecordingView = {
  id: string;
  lessonId: string;
  url: string;
  title: string | null;
};

export async function fetchLessonContentUnlockMap(
  supabase: SupabaseClient,
  userId: string,
  lessons: LessonUnlockRef[],
  access: CourseAccessContext
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (lessons.length === 0) return map;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && (await canAccessAdminPanel(user, supabase))) {
    for (const lesson of lessons) {
      map.set(lesson.id, isLessonContentUnlockedForUser(access, lesson, true));
    }
    return map;
  }

  const rpcLessonIds: string[] = [];

  for (const lesson of lessons) {
    if (isCommunityCourseLesson(access, lesson.course_id)) {
      map.set(
        lesson.id,
        isLessonContentUnlockedForUser(access, lesson, undefined)
      );
    } else {
      rpcLessonIds.push(lesson.id);
    }
  }

  if (rpcLessonIds.length === 0) return map;

  const results = await Promise.all(
    rpcLessonIds.map(async (lessonId) => {
      const { data, error } = await supabase.rpc("is_lesson_content_unlocked", {
        p_user_id: userId,
        p_lesson_id: lessonId,
      });
      if (error) throw error;
      return [lessonId, Boolean(data)] as const;
    })
  );

  for (const [lessonId, unlocked] of results) {
    const lesson = lessons.find((row) => row.id === lessonId);
    if (!lesson) continue;
    map.set(
      lessonId,
      isLessonContentUnlockedForUser(access, lesson, unlocked)
    );
  }

  return map;
}

export async function fetchLessonRecordingsForUser(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Map<string, LessonRecordingView>> {
  const map = new Map<string, LessonRecordingView>();
  if (lessonIds.length === 0) return map;

  const { data: enrollmentRows } = await supabase
    .from("course_enrollments")
    .select("course_id, delivery_mode, cohort_id")
    .eq("user_id", userId);

  const cohortIds = [
    ...new Set(
      (enrollmentRows ?? [])
        .filter((row) => row.delivery_mode === "group" && row.cohort_id)
        .map((row) => row.cohort_id as string)
    ),
  ];

  const [{ data: studentRecordings }, { data: cohortRecordings }] = await Promise.all([
    supabase
      .from("lesson_recordings")
      .select("id, lesson_id, storage_path, title")
      .eq("student_id", userId)
      .in("lesson_id", lessonIds),
    cohortIds.length > 0
      ? supabase
          .from("lesson_recordings")
          .select("id, lesson_id, storage_path, title")
          .in("cohort_id", cohortIds)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as { id: string; lesson_id: string; storage_path: string; title: string | null }[] }),
  ]);

  for (const row of studentRecordings ?? []) {
    map.set(row.lesson_id, {
      id: row.id,
      lessonId: row.lesson_id,
      url: row.storage_path,
      title: row.title,
    });
  }

  for (const row of cohortRecordings ?? []) {
    if (!map.has(row.lesson_id)) {
      map.set(row.lesson_id, {
        id: row.id,
        lessonId: row.lesson_id,
        url: row.storage_path,
        title: row.title,
      });
    }
  }

  return map;
}

function isExternalRecordingUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function recordingEmbedUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!isExternalRecordingUrl(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.hostname.includes("youtu.be")
        ? parsed.pathname.slice(1)
        : parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (parsed.hostname.includes("loom.com")) {
      const match = parsed.pathname.match(/\/share\/([^/?]+)/);
      if (match) return `https://www.loom.com/embed/${match[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}
