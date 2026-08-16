import "server-only";

import { actorFilter, resolveCourseActor } from "@/lib/kids/course-actor";
import {
  formatKidsCohortWeeklyLabel,
  isKidsCohortStartInFuture,
} from "@/lib/learning/kids-cohort-display";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const KIDS_CONTENT_TRACK = "kids";

export type KidsCourseSummary = {
  id: string;
  name: string;
  cohortId: string | null;
  cohortName: string | null;
  startDate: string | null;
  weeklyLabel: string | null;
  gated: boolean;
};

function kidsQueryClient(userClient: SupabaseClient): SupabaseClient {
  return tryCreateServiceRoleClient().client ?? userClient;
}

function uniqueCourseIds(rows: Array<{ course_id?: string | null } | null> | null): string[] {
  return [
    ...new Set(
      (rows ?? [])
        .map((row) => row?.course_id ?? null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

async function collectKidCourseIds(
  db: SupabaseClient,
  kidProfileId: string
): Promise<{ accessIds: string[]; enrolledIds: string[] }> {
  const [{ data: accessRows }, { data: enrollmentRows }, { data: packageRows }] = await Promise.all([
    db.from("course_access").select("course_id").eq("kid_profile_id", kidProfileId),
    db.from("course_enrollments").select("course_id").eq("kid_profile_id", kidProfileId),
    db.from("student_packages").select("course_id").eq("kid_profile_id", kidProfileId),
  ]);

  return {
    accessIds: uniqueCourseIds(accessRows),
    enrolledIds: uniqueCourseIds([...(enrollmentRows ?? []), ...(packageRows ?? [])]),
  };
}

async function ensureKidCourseAccess(
  db: SupabaseClient,
  kidProfileId: string,
  courseIds: string[]
) {
  if (courseIds.length === 0) return;

  const { data: existing } = await db
    .from("course_access")
    .select("course_id")
    .eq("kid_profile_id", kidProfileId)
    .in("course_id", courseIds);

  const have = new Set(uniqueCourseIds(existing));
  const missing = courseIds.filter((id) => !have.has(id));
  if (missing.length === 0) return;

  const grantedAt = new Date().toISOString();
  await db.from("course_access").upsert(
    missing.map((courseId) => ({
      user_id: null,
      kid_profile_id: kidProfileId,
      course_id: courseId,
      granted_at: grantedAt,
    })),
    { onConflict: "kid_profile_id,course_id" }
  );
}

type CohortPlacementRow = {
  id: string;
  name: string | null;
  start_date: string | null;
  start_day_of_week: string | null;
  weekly_session_start: string | null;
  weekly_session_end: string | null;
  weekly_session_has_time: boolean | null;
};

async function loadPlacementsForCourses(
  db: SupabaseClient,
  actorColumn: "kid_profile_id" | "user_id",
  actorValue: string,
  courses: Array<{ id: string; name: string }>
): Promise<KidsCourseSummary[]> {
  if (courses.length === 0) return [];

  const courseIds = courses.map((course) => course.id);
  const { data: enrollments } = await db
    .from("course_enrollments")
    .select("course_id, cohort_id")
    .eq(actorColumn, actorValue)
    .in("course_id", courseIds);

  const cohortIdByCourse = new Map<string, string>();
  for (const row of enrollments ?? []) {
    const courseId = row.course_id as string | null;
    const cohortId = row.cohort_id as string | null;
    if (courseId && cohortId && !cohortIdByCourse.has(courseId)) {
      cohortIdByCourse.set(courseId, cohortId);
    }
  }

  const cohortIds = [...new Set(cohortIdByCourse.values())];
  const { data: cohorts } =
    cohortIds.length > 0
      ? await db
          .from("cohorts")
          .select(
            "id, name, start_date, start_day_of_week, weekly_session_start, weekly_session_end, weekly_session_has_time"
          )
          .in("id", cohortIds)
      : { data: [] as CohortPlacementRow[] };

  const cohortById = new Map(
    ((cohorts ?? []) as CohortPlacementRow[]).map((cohort) => [cohort.id, cohort])
  );

  return courses.map((course) => {
    const cohortId = cohortIdByCourse.get(course.id) ?? null;
    const cohort = cohortId ? (cohortById.get(cohortId) ?? null) : null;
    const startDate = cohort?.start_date?.slice(0, 10) ?? null;
    return {
      id: course.id,
      name: course.name,
      cohortId,
      cohortName: cohort?.name ?? null,
      startDate,
      weeklyLabel: cohort
        ? formatKidsCohortWeeklyLabel({
            startDayOfWeek: cohort.start_day_of_week,
            weeklySessionStart: cohort.weekly_session_start,
            weeklySessionEnd: cohort.weekly_session_end,
            weeklySessionHasTime: Boolean(cohort.weekly_session_has_time),
          })
        : null,
      gated: isKidsCohortStartInFuture(startDate),
    };
  });
}

/** Courses tagged content_track = 'kids' that the active actor is enrolled in or can access. */
export async function fetchAccessibleKidsCourses(
  supabase: SupabaseClient,
  userId: string
): Promise<KidsCourseSummary[]> {
  const actor = await resolveCourseActor(supabase, userId);

  if (actor.kind === "kid") {
    const db = kidsQueryClient(supabase);
    const { accessIds, enrolledIds } = await collectKidCourseIds(db, actor.kidProfileId);
    const courseIds = [...new Set([...accessIds, ...enrolledIds])];
    if (courseIds.length === 0) return [];

    const { data: courses, error } = await db
      .from("courses")
      .select("id, name")
      .eq("content_track", KIDS_CONTENT_TRACK)
      .in("id", courseIds)
      .order("display_order", { ascending: true });

    if (error) throw error;

    const kidsCourses = (courses ?? []).map((course) => ({
      id: course.id as string,
      name: (course.name as string) || "Course",
    }));
    const kidsCourseIds = kidsCourses.map((course) => course.id);
    const missingAccess = enrolledIds.filter((id) => kidsCourseIds.includes(id) && !accessIds.includes(id));
    await ensureKidCourseAccess(db, actor.kidProfileId, missingAccess);

    return loadPlacementsForCourses(db, "kid_profile_id", actor.kidProfileId, kidsCourses);
  }

  const filter = actorFilter(actor);
  const { data: accessRows, error: accessError } = await supabase
    .from("course_access")
    .select("course_id")
    .eq(filter.column, filter.value);

  if (accessError) throw accessError;

  const courseIds = uniqueCourseIds(accessRows);
  if (courseIds.length === 0) return [];

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, name")
    .eq("content_track", KIDS_CONTENT_TRACK)
    .in("id", courseIds)
    .order("display_order", { ascending: true });

  if (error) throw error;

  const kidsCourses = (courses ?? []).map((course) => ({
    id: course.id as string,
    name: (course.name as string) || "Course",
  }));

  return loadPlacementsForCourses(supabase, "user_id", userId, kidsCourses);
}

/**
 * Group kids courses unlock from `cohort_lesson_unlocks`, not private-course
 * "access means every lesson". Before the first unlock, every lesson is locked.
 */
export async function fetchKidsCourseLessonUnlockMap(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  lessonIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map(lessonIds.map((id) => [id, false]));
  if (lessonIds.length === 0) return map;

  const actor = await resolveCourseActor(supabase, userId);
  const db = actor.kind === "kid" ? kidsQueryClient(supabase) : supabase;
  const filter = actorFilter(actor);

  const { data: enrollment } = await db
    .from("course_enrollments")
    .select("cohort_id, delivery_mode")
    .eq(filter.column, filter.value)
    .eq("course_id", courseId)
    .maybeSingle();

  const cohortId = (enrollment?.cohort_id as string | null) ?? null;
  if (cohortId) {
    const { data: unlocks } = await db
      .from("cohort_lesson_unlocks")
      .select("lesson_id")
      .eq("cohort_id", cohortId)
      .in("lesson_id", lessonIds);

    for (const row of unlocks ?? []) {
      const lessonId = row.lesson_id as string | null;
      if (lessonId && map.has(lessonId)) map.set(lessonId, true);
    }
    return map;
  }

  const unlockQuery = db.from("student_lesson_unlocks").select("lesson_id").in("lesson_id", lessonIds);
  const { data: unlocks } =
    actor.kind === "kid"
      ? await unlockQuery.eq("kid_profile_id", actor.kidProfileId)
      : await unlockQuery.eq("student_id", userId);

  for (const row of unlocks ?? []) {
    const lessonId = row.lesson_id as string | null;
    if (lessonId && map.has(lessonId)) map.set(lessonId, true);
  }

  return map;
}

export function kidsCourseLearnPath(courseId: string) {
  return `/dashboard/learn/kids/${courseId}`;
}
