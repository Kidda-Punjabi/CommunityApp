import type { SupabaseClient } from "@supabase/supabase-js";
import { getLeaderboardName, type ProfileNameFields } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { loadViewerWeeklyPoints } from "./load-viewer-weekly-points";
import { getCurrentWeekStart } from "./week";

export type LeaderboardEntry = {
  rank: number | null;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  preferredName: string | null;
  fullName: string | null;
  learnerLevel: number | null;
  points: number;
  isViewer?: boolean;
};

/** "week" = XP earned that week. "all" = lifetime XP. */
export type LeaderboardMode = "week" | "all";

export type LeaderboardData = {
  mode: LeaderboardMode;
  weekStart: string;
  currentWeekStart: string;
  viewerUserId: string;
  entries: LeaderboardEntry[];
  viewerRow: LeaderboardEntry;
  availableWeeks: string[];
};

type LeaderboardProfile = ProfileNameFields & { avatar_url?: string | null; kidda_level?: number | null };

type RankedRow = { user_id: string; xp: number | string; rank: number | string };

function buildEntry(
  userId: string,
  points: number,
  rank: number | null,
  profile: LeaderboardProfile | null,
  isViewer = false
): LeaderboardEntry {
  return {
    rank,
    userId,
    displayName: getLeaderboardName(profile),
    avatarUrl: profile?.avatar_url ?? null,
    preferredName: profile?.preferred_name ?? null,
    fullName: profile?.full_name ?? null,
    learnerLevel: profile?.kidda_level ?? null,
    points,
    isViewer,
  };
}

/**
 * One XP leaderboard. Ranks come from the XP log (xp_leaderboard): this week's XP for
 * "week", lifetime XP for "all". People who hide from the leaderboard are left out.
 */
export async function loadLeaderboard(
  supabase: SupabaseClient,
  weekStart: string,
  viewerUserId: string,
  mode: LeaderboardMode = "week"
): Promise<LeaderboardData> {
  const currentWeekStart = getCurrentWeekStart();

  const [{ data: rankedRows, error }, { data: weekRows }, viewerProfile] = await Promise.all([
    supabase.rpc("xp_leaderboard", { p_week: mode === "all" ? null : weekStart }),
    supabase.rpc("xp_leaderboard_weeks"),
    loadEditableProfile(supabase, viewerUserId),
  ]);
  if (error) console.error("[leaderboard] xp_leaderboard failed:", error.message);

  const ranked = ((rankedRows ?? []) as RankedRow[]).map((row) => ({
    userId: row.user_id,
    xp: Number(row.xp),
    rank: Number(row.rank),
  }));
  const top10 = ranked.slice(0, 10);
  const viewerRanked = ranked.find((row) => row.userId === viewerUserId) ?? null;
  const viewerXp = viewerRanked?.xp ?? (await loadViewerXp(supabase, viewerUserId, mode, weekStart));

  const { data: profileRows } = top10.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, preferred_name, avatar_url, kidda_level")
        .in("id", top10.map((row) => row.userId))
    : { data: [] };
  const profiles = new Map(
    ((profileRows ?? []) as (LeaderboardProfile & { id: string })[]).map((row) => [row.id, row])
  );

  const entries = top10.map((row) =>
    buildEntry(row.userId, row.xp, row.rank, profiles.get(row.userId) ?? null, row.userId === viewerUserId)
  );

  const viewerRow = buildEntry(
    viewerUserId,
    viewerXp,
    viewerRanked?.rank ?? (viewerXp > 0 ? ranked.filter((row) => row.xp > viewerXp).length + 1 : null),
    viewerProfile,
    true
  );

  const weekSet = new Set<string>([currentWeekStart, weekStart]);
  for (const row of (weekRows ?? []) as { week_start: string }[]) {
    if (row.week_start) weekSet.add(row.week_start);
  }

  return {
    mode,
    weekStart,
    currentWeekStart,
    viewerUserId,
    entries,
    viewerRow,
    availableWeeks: [...weekSet].sort((a, b) => b.localeCompare(a)),
  };
}

/** The viewer's XP when they aren't in the ranked list (for example hidden from the leaderboard). */
async function loadViewerXp(
  supabase: SupabaseClient,
  userId: string,
  mode: LeaderboardMode,
  weekStart: string
): Promise<number> {
  if (mode === "all") {
    const { data } = await supabase.from("profiles").select("total_xp").eq("id", userId).maybeSingle();
    return Number(data?.total_xp ?? 0);
  }
  return loadViewerWeeklyPoints(supabase, userId, weekStart);
}
