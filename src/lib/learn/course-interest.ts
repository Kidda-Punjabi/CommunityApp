import "server-only";

import { getDisplayName } from "@/lib/profile/display-name";
import { LEARN_COURSE_LEVELS, isComingSoonLevel } from "@/lib/learn/course-levels";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ComingSoonCourseLevel = "intermediate" | "advanced";

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
  return isComingSoonLevel(value as ComingSoonCourseLevel);
}

export async function loadRegisteredComingSoonLevels(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<ComingSoonCourseLevel>> {
  const { data, error } = await supabase
    .from("course_interest_signups")
    .select("course_level")
    .eq("user_id", userId);

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
    .select("id, user_id, course_level, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const userIds = [...new Set((rows ?? []).map((row) => row.user_id as string))];
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, preferred_name")
        .in("id", userIds)
    : { data: [] as never[] };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id as string, profile])
  );

  const emailById = new Map<string, string | null>();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await supabase.auth.admin.getUserById(userId);
      emailById.set(userId, data.user?.email ?? null);
    })
  );

  return (rows ?? []).map((row) => {
    const userId = row.user_id as string;
    const courseLevel = row.course_level as ComingSoonCourseLevel;
    const profile = profileById.get(userId);
    return {
      id: row.id as string,
      userId,
      courseLevel,
      courseTitle: LEARN_COURSE_LEVELS[courseLevel]?.title ?? courseLevel,
      displayName: getDisplayName(profile ?? null) ?? emailById.get(userId) ?? "Member",
      email: emailById.get(userId) ?? null,
      createdAt: row.created_at as string,
    };
  });
}
