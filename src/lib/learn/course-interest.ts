import "server-only";

import { loadEmailsByUserId } from "@/lib/admin/load-admin-profiles-with-email";
import { getDisplayName } from "@/lib/profile/display-name";
import { LEARN_COURSE_LEVELS, isComingSoonLevel } from "@/lib/learn/course-levels";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ComingSoonCourseLevel =
  | "intermediate"
  | "advanced"
  | "kids_intermediate"
  | "kids_advanced";

const KIDS_COMING_SOON_LEVELS = new Set<ComingSoonCourseLevel>([
  "kids_intermediate",
  "kids_advanced",
]);

export type CourseInterestSignup = {
  id: string;
  userId: string;
  courseLevel: ComingSoonCourseLevel;
  courseTitle: string;
  displayName: string;
  email: string | null;
  createdAt: string;
};

export function isComingSoonCourseLevel(value: string): value is ComingSoonCourseLevel {
  return (
    isComingSoonLevel(value as "intermediate" | "advanced") ||
    KIDS_COMING_SOON_LEVELS.has(value as ComingSoonCourseLevel)
  );
}

export async function loadRegisteredComingSoonLevels(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<ComingSoonCourseLevel>> {
  const actor = await resolveCourseActor(supabase, userId);
  const query = supabase.from("course_interest_signups").select("course_level");
  const { data, error } =
    actor.kind === "kid"
      ? await query.eq("kid_profile_id", actor.kidProfileId)
      : await query.eq("user_id", userId);

  if (error) {
    console.error("loadRegisteredComingSoonLevels:", error.message);
    return new Set();
  }

  const levels = new Set<ComingSoonCourseLevel>();
  for (const row of data ?? []) {
    const level = row.course_level as string;
    if (isComingSoonCourseLevel(level)) levels.add(level);
  }
  return levels;
}

export async function loadCourseInterestSignups(
  supabase: SupabaseClient
): Promise<CourseInterestSignup[]> {
  const { data: rows, error } = await supabase
    .from("course_interest_signups")
    .select("id, user_id, kid_profile_id, course_level, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const userIds = [
    ...new Set(
      (rows ?? [])
        .map((row) => row.user_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, preferred_name")
        .in("id", userIds)
    : { data: [] as never[] };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id as string, profile])
  );

  const emailById = await loadEmailsByUserId(supabase, userIds);

  return (rows ?? []).map((row) => {
    const userId = (row.user_id as string | null) ?? "";
    const courseLevel = row.course_level as ComingSoonCourseLevel;
    const profile = userId ? profileById.get(userId) : undefined;
    return {
      id: row.id as string,
      userId: userId || (row.kid_profile_id as string) || "",
      courseLevel,
      courseTitle:
        courseLevel === "kids_intermediate"
          ? "Kids Intermediate"
          : courseLevel === "kids_advanced"
            ? "Kids Advanced"
            : LEARN_COURSE_LEVELS[courseLevel]?.title ?? courseLevel,
      displayName: getDisplayName(profile ?? null) ?? emailById.get(userId) ?? "Member",
      email: emailById.get(userId) ?? null,
      createdAt: row.created_at as string,
    };
  });
}
