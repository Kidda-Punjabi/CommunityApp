import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ParentEntryFacts = {
  kidCount: number;
  soleKid: { id: string; ageTier: string } | null;
  hasOwnAdultCourse: boolean;
};

type CourseEmbed = { content_track?: string | null } | { content_track?: string | null }[] | null;

function contentTrack(courses: CourseEmbed): string | null {
  const course = Array.isArray(courses) ? courses[0] : courses;
  return course?.content_track ?? null;
}

function countsAsOwnAdultCourse(courses: CourseEmbed): boolean {
  return contentTrack(courses) !== "kids";
}

/** Parent-level course_access or course_enrollments, excluding kids-track rows. */
export async function loadParentEntryFacts(
  supabase: SupabaseClient,
  userId: string
): Promise<ParentEntryFacts> {
  const [{ data: kids }, { data: accessRows }, { data: enrollmentRows }] = await Promise.all([
    supabase
      .from("kid_profiles")
      .select("id, age_tier")
      .eq("parent_user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("course_access")
      .select("course_id, courses(content_track)")
      .eq("user_id", userId)
      .is("kid_profile_id", null),
    supabase
      .from("course_enrollments")
      .select("course_id, courses(content_track)")
      .eq("user_id", userId)
      .is("kid_profile_id", null),
  ]);

  const kidRows = kids ?? [];
  const sole = kidRows.length === 1 ? kidRows[0] : null;
  const hasOwnAdultCourse = [...(accessRows ?? []), ...(enrollmentRows ?? [])].some((row) =>
    countsAsOwnAdultCourse(row.courses as CourseEmbed)
  );

  return {
    kidCount: kidRows.length,
    soleKid: sole ? { id: sole.id as string, ageTier: sole.age_tier as string } : null,
    hasOwnAdultCourse,
  };
}
