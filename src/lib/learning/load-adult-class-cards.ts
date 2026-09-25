import "server-only";

import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";
import { isPublicLearnCourse, type CourseRecord } from "@/lib/membership/courses";
import { getCourseRequiredTier, type PaidCourseTier } from "@/lib/membership/access";
import { learnTrackPath, type LearnTrackId } from "@/lib/learning/learn-catalog";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdultClassCard = {
  courseId: string;
  courseName: string;
  tier: PaidCourseTier;
  href: string;
  weekLesson: string | null;
  nextClass: string | null;
};

type CourseJoin = {
  id?: string;
  name?: string | null;
  required_tier?: string | null;
  is_public?: boolean | null;
  content_track?: string | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function trackHref(tier: PaidCourseTier): string {
  const track: LearnTrackId =
    tier === "community" ? "community" : tier === "beginners" ? "beginners" : "foundational";
  return learnTrackPath(track);
}

function formatNextClass(startsAt: string, endsAt: string | null): string | null {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const date = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
  const time: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: UK_DISPLAY_TIMEZONE,
  };
  const startLabel = start.toLocaleTimeString("en-GB", time);
  if (!endsAt) return `${date}, ${startLabel}`;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return `${date}, ${startLabel}`;
  return `${date}, ${startLabel}–${end.toLocaleTimeString("en-GB", time)}`;
}

/**
 * Full-width "Your class" cards for the parent's own adult enrollments.
 * Kids-track rows are never included.
 */
export async function loadAdultClassCards(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<AdultClassCard[]> {
  const [{ data: enrollments }, { data: accessRows }] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select(
        "course_id, cohort_id, courses(id, name, required_tier, is_public, content_track)"
      )
      .eq("user_id", userId)
      .is("kid_profile_id", null),
    supabase
      .from("course_access")
      .select("course_id, courses(id, name, required_tier, is_public, content_track)")
      .eq("user_id", userId)
      .is("kid_profile_id", null),
  ]);

  type Draft = {
    courseId: string;
    courseName: string;
    tier: PaidCourseTier;
    cohortId: string | null;
  };

  const byCourse = new Map<string, Draft>();

  function consider(course: CourseJoin | null, cohortId: string | null) {
    if (!course?.id || course.content_track === "kids") return;
    const record: CourseRecord = {
      id: course.id,
      name: course.name ?? "Course",
      required_tier: course.required_tier,
      is_public: course.is_public,
    };
    if (!isPublicLearnCourse(record)) return;
    const tier = getCourseRequiredTier(record);
    if (tier !== "foundational" && tier !== "beginners" && tier !== "community") return;
    const existing = byCourse.get(course.id);
    if (existing) {
      if (!existing.cohortId && cohortId) existing.cohortId = cohortId;
      return;
    }
    byCourse.set(course.id, {
      courseId: course.id,
      courseName: record.name,
      tier,
      cohortId,
    });
  }

  for (const row of enrollments ?? []) {
    consider(one(row.courses as CourseJoin | CourseJoin[] | null), (row.cohort_id as string | null) ?? null);
  }
  for (const row of accessRows ?? []) {
    consider(one(row.courses as CourseJoin | CourseJoin[] | null), null);
  }

  const drafts = [...byCourse.values()];
  if (drafts.length === 0) return [];

  const cohortIds = drafts.map((draft) => draft.cohortId).filter((id): id is string => Boolean(id));
  const nowIso = now.toISOString();

  const { data: sessions } =
    cohortIds.length > 0
      ? await supabase
          .from("tutor_scheduled_sessions")
          .select("cohort_id, starts_at, ends_at, week_number, status")
          .in("cohort_id", cohortIds)
          .gte("starts_at", nowIso)
          .order("starts_at", { ascending: true })
      : { data: [] as Array<Record<string, unknown>> };

  const nextByCohort = new Map<
    string,
    { startsAt: string; endsAt: string | null; weekNumber: number | null }
  >();
  for (const session of sessions ?? []) {
    if (session.status === "cancelled") continue;
    const cohortId = session.cohort_id as string | null;
    if (!cohortId || nextByCohort.has(cohortId)) continue;
    nextByCohort.set(cohortId, {
      startsAt: session.starts_at as string,
      endsAt: (session.ends_at as string | null) ?? null,
      weekNumber: (session.week_number as number | null) ?? null,
    });
  }

  const lessonKeys = drafts.flatMap((draft) => {
    const next = draft.cohortId ? nextByCohort.get(draft.cohortId) : undefined;
    if (!next?.weekNumber) return [];
    return [{ courseId: draft.courseId, lessonNumber: next.weekNumber }];
  });

  const titles = new Map<string, string>();
  if (lessonKeys.length > 0) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("course_id, lesson_number, title")
      .in(
        "course_id",
        lessonKeys.map((key) => key.courseId)
      );
    for (const lesson of lessons ?? []) {
      const courseId = lesson.course_id as string;
      const number = lesson.lesson_number as number;
      const title = (lesson.title as string | null)?.trim();
      if (title) titles.set(`${courseId}:${number}`, title);
    }
  }

  const tierOrder: PaidCourseTier[] = ["foundational", "beginners", "community"];

  return drafts
    .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))
    .map((draft) => {
      const next = draft.cohortId ? nextByCohort.get(draft.cohortId) : undefined;
      const week = next?.weekNumber ?? null;
      const lessonTitle = week != null ? titles.get(`${draft.courseId}:${week}`) : undefined;
      const weekLesson =
        week == null
          ? null
          : lessonTitle
            ? `Week ${week} · ${lessonTitle}`
            : `Week ${week}`;
      return {
        courseId: draft.courseId,
        courseName: draft.courseName,
        tier: draft.tier,
        href: trackHref(draft.tier),
        weekLesson,
        nextClass: next ? formatNextClass(next.startsAt, next.endsAt) : null,
      };
    });
}
