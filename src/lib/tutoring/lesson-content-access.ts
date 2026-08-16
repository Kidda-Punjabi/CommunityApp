import {
  isCommunityCourseLesson,
  isLessonContentUnlockedForUser,
} from "@/lib/learning/learn-access";
import { isPrivateAccessCourse } from "@/lib/learning/private-courses";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { actorFilter, resolveCourseActor } from "@/lib/kids/course-actor";
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

  const isAdmin = Boolean(user && (await canAccessAdminPanel(user, supabase)));

  /** Courses where this user is enrolled as a student — use real unlocks, not admin preview. */
  const enrolledCourseIds = new Set<string>();
  if (isAdmin) {
    const courseIds = [...new Set(lessons.map((lesson) => lesson.course_id))];
    const actor = await resolveCourseActor(supabase, userId);
    const filter = actorFilter(actor);
    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("course_id")
      .eq(filter.column, filter.value)
      .in("course_id", courseIds);
    for (const row of enrollments ?? []) {
      if (row.course_id) enrolledCourseIds.add(row.course_id as string);
    }
  }

  const rpcLessonIds: string[] = [];

  for (const lesson of lessons) {
    const adminPreview =
      isAdmin && !enrolledCourseIds.has(lesson.course_id);

    if (adminPreview) {
      map.set(lesson.id, isLessonContentUnlockedForUser(access, lesson, true));
      continue;
    }

    if (
      isCommunityCourseLesson(access, lesson.course_id) ||
      isPrivateAccessCourse(access, lesson.course_id)
    ) {
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

type RecordingRow = {
  id: string;
  lesson_id: string;
  storage_path: string;
  title: string | null;
  cohort_id?: string | null;
};

function setRecordingIfAbsent(
  map: Map<string, LessonRecordingView>,
  row: { id: string; lessonId: string; url: string; title: string | null }
) {
  if (map.has(row.lessonId)) return;
  map.set(row.lessonId, row);
}

/**
 * For approved alternate-cohort switches, map curriculum lesson → destination cohort
 * so Learn shows the recording from the session the student actually attended.
 */
async function fetchAlternateCohortByLessonId(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Map<string, string>> {
  const preferred = new Map<string, string>();
  if (lessonIds.length === 0) return preferred;

  const { data: switches, error: switchError } = await supabase
    .from("cohort_switch_requests")
    .select("session_id, to_cohort_id")
    .eq("student_id", userId)
    .eq("status", "approved");

  if (switchError) throw switchError;
  if (!switches?.length) return preferred;

  const fromSessionIds = [
    ...new Set(switches.map((row) => row.session_id as string).filter(Boolean)),
  ];
  const { data: fromSessions, error: fromError } = await supabase
    .from("tutor_scheduled_sessions")
    .select("id, cohort_id, course_id, starts_at")
    .in("id", fromSessionIds);

  if (fromError) throw fromError;
  if (!fromSessions?.length) return preferred;

  const fromById = new Map(fromSessions.map((row) => [row.id as string, row] as const));
  const homeCohortIds = [
    ...new Set(
      fromSessions
        .map((row) => row.cohort_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const courseIds = [
    ...new Set(
      fromSessions
        .map((row) => row.course_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: cohortSessions }, { data: lessons }] = await Promise.all([
    homeCohortIds.length > 0
      ? supabase
          .from("tutor_scheduled_sessions")
          .select("id, cohort_id, starts_at")
          .in("cohort_id", homeCohortIds)
          .neq("status", "cancelled")
          .order("starts_at", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; cohort_id: string; starts_at: string }[] }),
    courseIds.length > 0
      ? supabase
          .from("lessons")
          .select("id, course_id, lesson_number")
          .in("course_id", courseIds)
          .in("id", lessonIds)
      : Promise.resolve({
          data: [] as { id: string; course_id: string; lesson_number: number }[],
        }),
  ]);

  const ordinalBySessionId = new Map<string, number>();
  const sessionsByCohort = new Map<string, { id: string; cohort_id: string; starts_at: string }[]>();
  for (const row of cohortSessions ?? []) {
    const list = sessionsByCohort.get(row.cohort_id) ?? [];
    list.push(row);
    sessionsByCohort.set(row.cohort_id, list);
  }
  for (const list of sessionsByCohort.values()) {
    list.forEach((row, index) => {
      ordinalBySessionId.set(row.id, index + 1);
    });
  }

  const lessonIdByCourseAndNumber = new Map<string, string>();
  for (const lesson of lessons ?? []) {
    lessonIdByCourseAndNumber.set(
      `${lesson.course_id}:${lesson.lesson_number}`,
      lesson.id
    );
  }

  for (const row of switches) {
    const from = fromById.get(row.session_id as string);
    const toCohortId = row.to_cohort_id as string | null;
    if (!from?.cohort_id || !from.course_id || !toCohortId) continue;
    const lessonNumber = ordinalBySessionId.get(from.id as string);
    if (!lessonNumber) continue;
    const lessonId = lessonIdByCourseAndNumber.get(`${from.course_id}:${lessonNumber}`);
    if (!lessonId) continue;
    preferred.set(lessonId, toCohortId);
  }

  return preferred;
}

export async function fetchLessonRecordingsForUser(
  supabase: SupabaseClient,
  userId: string,
  lessonIds: string[]
): Promise<Map<string, LessonRecordingView>> {
  const map = new Map<string, LessonRecordingView>();
  if (lessonIds.length === 0) return map;

  const actor = await resolveCourseActor(supabase, userId);
  const filter = actorFilter(actor);
  const { data: enrollmentRows } = await supabase
    .from("course_enrollments")
    .select("course_id, delivery_mode, cohort_id")
    .eq(filter.column, filter.value);

  const homeCohortIds = [
    ...new Set(
      (enrollmentRows ?? [])
        .filter((row) => row.delivery_mode === "group" && row.cohort_id)
        .map((row) => row.cohort_id as string)
    ),
  ];

  const alternateCohortByLessonId = await fetchAlternateCohortByLessonId(
    supabase,
    userId,
    lessonIds
  );
  const alternateCohortIds = [...new Set(alternateCohortByLessonId.values())];
  const allCohortIds = [...new Set([...homeCohortIds, ...alternateCohortIds])];

  const [{ data: studentRecordings }, { data: cohortRecordings }] = await Promise.all([
    supabase
      .from("lesson_recordings")
      .select("id, lesson_id, storage_path, title, cohort_id")
      .eq("student_id", userId)
      .in("lesson_id", lessonIds),
    allCohortIds.length > 0
      ? supabase
          .from("lesson_recordings")
          .select("id, lesson_id, storage_path, title, cohort_id")
          .in("cohort_id", allCohortIds)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as RecordingRow[] }),
  ]);

  // 1) Student-specific (1-1) recordings win.
  for (const row of studentRecordings ?? []) {
    map.set(row.lesson_id, {
      id: row.id,
      lessonId: row.lesson_id,
      url: row.storage_path,
      title: row.title,
    });
  }

  const recordingsByCohortLesson = new Map<string, RecordingRow>();
  for (const row of cohortRecordings ?? []) {
    if (!row.cohort_id) continue;
    recordingsByCohortLesson.set(`${row.cohort_id}:${row.lesson_id}`, row);
  }

  // 2) Approved alternate cohort recording for that lesson (session they attended).
  for (const [lessonId, toCohortId] of alternateCohortByLessonId) {
    if (map.has(lessonId)) continue;
    const row = recordingsByCohortLesson.get(`${toCohortId}:${lessonId}`);
    if (!row) continue;
    map.set(lessonId, {
      id: row.id,
      lessonId: row.lesson_id,
      url: row.storage_path,
      title: row.title,
    });
  }

  // 3) Home cohort recordings.
  for (const cohortId of homeCohortIds) {
    for (const lessonId of lessonIds) {
      if (map.has(lessonId)) continue;
      const row = recordingsByCohortLesson.get(`${cohortId}:${lessonId}`);
      if (!row) continue;
      map.set(lessonId, {
        id: row.id,
        lessonId: row.lesson_id,
        url: row.storage_path,
        title: row.title,
      });
    }
  }

  // 4) Lesson log recording URLs as fallback (prefer alternate cohort, then home).
  if (allCohortIds.length > 0) {
    const { data: logRows } = await supabase
      .from("cohort_lesson_log_entries")
      .select("id, lesson_id, cohort_id, recording_url")
      .in("cohort_id", allCohortIds)
      .in("lesson_id", lessonIds)
      .not("recording_url", "is", null);

    const logByCohortLesson = new Map<
      string,
      { id: string; lesson_id: string; recording_url: string }
    >();
    for (const row of logRows ?? []) {
      const url = typeof row.recording_url === "string" ? row.recording_url.trim() : "";
      if (!url || !row.cohort_id || !row.lesson_id) continue;
      logByCohortLesson.set(`${row.cohort_id}:${row.lesson_id}`, {
        id: row.id,
        lesson_id: row.lesson_id,
        recording_url: url,
      });
    }

    for (const [lessonId, toCohortId] of alternateCohortByLessonId) {
      const row = logByCohortLesson.get(`${toCohortId}:${lessonId}`);
      if (!row) continue;
      setRecordingIfAbsent(map, {
        id: row.id,
        lessonId: row.lesson_id,
        url: row.recording_url,
        title: null,
      });
    }

    for (const cohortId of homeCohortIds) {
      for (const lessonId of lessonIds) {
        const row = logByCohortLesson.get(`${cohortId}:${lessonId}`);
        if (!row) continue;
        setRecordingIfAbsent(map, {
          id: row.id,
          lessonId: row.lesson_id,
          url: row.recording_url,
          title: null,
        });
      }
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
