import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLeaderboardName } from "@/lib/profile/display-name";
import { getCurrentWeekStart } from "@/lib/leaderboard/week";

export type CohortLeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  weeklyPoints: number;
  totalXp: number;
};

export type CohortLeaderboard = {
  cohortId: string;
  cohortName: string | null;
  weekStart: string;
  entries: CohortLeaderboardEntry[];
};

/**
 * Everyone currently in a group cohort, ranked by this week's points (ties broken by
 * total XP). Read with the service role: members and tutors may not be able to read
 * each other's points rows directly, and only names and totals are returned.
 */
export async function loadCohortLeaderboard(
  admin: SupabaseClient,
  cohortId: string,
  weekStart = getCurrentWeekStart()
): Promise<CohortLeaderboard | null> {
  const [{ data: cohort }, { data: members, error: memberError }] = await Promise.all([
    admin.from("cohorts").select("id, name").eq("id", cohortId).maybeSingle(),
    admin
      .from("cohort_members")
      .select("user_id")
      .eq("cohort_id", cohortId)
      .is("left_at", null)
      .is("kid_profile_id", null)
      .not("user_id", "is", null),
  ]);
  if (memberError) throw memberError;
  const userIds = [...new Set((members ?? []).map((row) => row.user_id as string))];
  if (userIds.length === 0) return null;

  const [{ data: profiles, error: profileError }, { data: points, error: pointsError }] = await Promise.all([
    admin.from("profiles").select("id, full_name, preferred_name, total_xp").in("id", userIds),
    admin.from("weekly_points").select("user_id, points").eq("week_start", weekStart).in("user_id", userIds),
  ]);
  if (profileError) throw profileError;
  if (pointsError) throw pointsError;

  const pointsByUser = new Map<string, number>();
  for (const row of points ?? []) {
    pointsByUser.set(row.user_id as string, (pointsByUser.get(row.user_id as string) ?? 0) + Number(row.points ?? 0));
  }

  const rows = (profiles ?? []).map((profile) => ({
    userId: profile.id as string,
    name: getLeaderboardName(profile),
    weeklyPoints: pointsByUser.get(profile.id as string) ?? 0,
    totalXp: Number(profile.total_xp ?? 0),
  }));
  rows.sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.totalXp - a.totalXp || a.name.localeCompare(b.name));

  // Equal points share a rank (1, 2, 2, 4).
  let lastPoints: number | null = null;
  let lastRank = 0;
  const entries = rows.map((row, index) => {
    const rank = row.weeklyPoints === lastPoints ? lastRank : index + 1;
    lastPoints = row.weeklyPoints;
    lastRank = rank;
    return { ...row, rank };
  });

  return {
    cohortId,
    cohortName: (cohort?.name as string | null) ?? null,
    weekStart,
    entries,
  };
}

/** The viewer's active group cohort on any of the given courses (adults only). */
export async function findViewerGroupCohortId(
  admin: SupabaseClient,
  userId: string,
  courseIds: string[]
): Promise<string | null> {
  if (courseIds.length === 0) return null;
  const { data, error } = await admin
    .from("cohort_members")
    .select("cohort_id, cohorts!inner(course_id)")
    .eq("user_id", userId)
    .is("kid_profile_id", null)
    .is("left_at", null)
    .in("cohorts.course_id", courseIds)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.cohort_id as string | undefined) ?? null;
}
