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

export type CohortPointsWindow = "week" | "rolling7";

export type CohortLeaderboard = {
  cohortId: string;
  cohortName: string | null;
  weekStart: string;
  /** "week" is the calendar week (Mon–Sun). "rolling7" is the last 7×24 hours. */
  pointsWindow: CohortPointsWindow;
  entries: CohortLeaderboardEntry[];
};

/**
 * Everyone currently in a group cohort, ranked by points (ties broken by total XP).
 * Read with the service role: members and tutors may not be able to read each
 * other's points rows directly, and only names and totals are returned.
 *
 * Points are XP from the XP log (One XP, Nov 2026): every way of earning counts.
 * "week" sums XP in this Monday-start week. "rolling7" sums XP from the last 7 days.
 */
export async function loadCohortLeaderboard(
  admin: SupabaseClient,
  cohortId: string,
  options?: { pointsWindow?: CohortPointsWindow; weekStart?: string }
): Promise<CohortLeaderboard | null> {
  const pointsWindow = options?.pointsWindow ?? "week";
  const weekStart = options?.weekStart ?? getCurrentWeekStart();
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

  const [{ data: profiles, error: profileError }, pointsByUser] = await Promise.all([
    admin.from("profiles").select("id, full_name, preferred_name, total_xp, hide_from_leaderboard").in("id", userIds),
    pointsWindow === "rolling7"
      ? practicePointsSince(admin, userIds, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      : weekPoints(admin, userIds, weekStart),
  ]);
  if (profileError) throw profileError;

  const rows = (profiles ?? []).filter((profile) => !profile.hide_from_leaderboard).map((profile) => ({
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
    pointsWindow,
    entries,
  };
}

async function weekPoints(
  admin: SupabaseClient,
  userIds: string[],
  weekStart: string
): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from("xp_awards")
    .select("user_id, xp")
    .eq("activity_week", weekStart)
    .neq("source", "opening_balance")
    .in("user_id", userIds);
  if (error) throw error;
  const pointsByUser = new Map<string, number>();
  for (const row of data ?? []) {
    pointsByUser.set(row.user_id as string, (pointsByUser.get(row.user_id as string) ?? 0) + Number(row.xp ?? 0));
  }
  return pointsByUser;
}

async function practicePointsSince(
  admin: SupabaseClient,
  userIds: string[],
  sinceIso: string
): Promise<Map<string, number>> {
  const pointsByUser = new Map<string, number>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("xp_awards")
      .select("user_id, xp")
      .in("user_id", userIds)
      .neq("source", "opening_balance")
      .gte("created_at", sinceIso)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      const userId = row.user_id as string;
      pointsByUser.set(userId, (pointsByUser.get(userId) ?? 0) + Number(row.xp ?? 0));
    }
    if (!data || data.length < pageSize) break;
  }
  return pointsByUser;
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
