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
  points: number;
  isViewer?: boolean;
};

export type LeaderboardData = {
  weekStart: string;
  currentWeekStart: string;
  viewerUserId: string;
  entries: LeaderboardEntry[];
  viewerRow: LeaderboardEntry;
  availableWeeks: string[];
};

type WeeklyPointsRow = {
  user_id: string;
  points: number;
  profiles:
    | (ProfileNameFields & { avatar_url?: string | null })
    | (ProfileNameFields & { avatar_url?: string | null })[]
    | null;
};

function unwrapProfile(
  profile: WeeklyPointsRow["profiles"]
): (ProfileNameFields & { avatar_url?: string | null }) | null {
  if (!profile) return null;
  return Array.isArray(profile) ? (profile[0] ?? null) : profile;
}

function buildEntry(
  userId: string,
  points: number,
  rank: number | null,
  profile: (ProfileNameFields & { avatar_url?: string | null }) | null,
  isViewer = false
): LeaderboardEntry {
  return {
    rank,
    userId,
    displayName: getLeaderboardName(profile),
    avatarUrl: profile?.avatar_url ?? null,
    preferredName: profile?.preferred_name ?? null,
    fullName: profile?.full_name ?? null,
    points,
    isViewer,
  };
}

// TODO: gate this query to community members only once Stripe purchase
// data is reliably available (see `memberships` table). For now, all users
// are included — no membership check applied.

export async function loadLeaderboard(
  supabase: SupabaseClient,
  weekStart: string,
  viewerUserId: string
): Promise<LeaderboardData> {
  const currentWeekStart = getCurrentWeekStart();

  const [{ data: weekRows }, { data: historyRows }, viewerProfile, viewerPoints] =
    await Promise.all([
      supabase
        .from("weekly_points")
        .select("user_id, points, profiles(full_name, preferred_name, avatar_url)")
        .eq("week_start", weekStart)
        .gt("points", 0)
        .order("points", { ascending: false })
        .order("updated_at", { ascending: true }),
      supabase
        .from("weekly_points")
        .select("week_start")
        .gt("points", 0)
        .order("week_start", { ascending: false }),
      loadEditableProfile(supabase, viewerUserId),
      loadViewerWeeklyPoints(supabase, viewerUserId, weekStart),
    ]);

  const ranked = (weekRows ?? []) as WeeklyPointsRow[];
  const allEntries: LeaderboardEntry[] = ranked.map((row, index) => {
    const profile = unwrapProfile(row.profiles);
    return buildEntry(row.user_id, row.points, index + 1, profile);
  });

  const top10 = allEntries.slice(0, 10);
  const viewerInTop10 = top10.some((entry) => entry.userId === viewerUserId);
  const viewerRankEntry = allEntries.find((entry) => entry.userId === viewerUserId);

  const viewerRow = buildEntry(
    viewerUserId,
    viewerRankEntry?.points ?? viewerPoints,
    viewerRankEntry?.rank ??
      (viewerPoints > 0 ? allEntries.filter((entry) => entry.points > viewerPoints).length + 1 : null),
    viewerProfile,
    true
  );

  const weekSet = new Set<string>([currentWeekStart]);
  for (const row of historyRows ?? []) {
    if (row.week_start) weekSet.add(row.week_start as string);
  }
  weekSet.add(weekStart);

  const availableWeeks = [...weekSet].sort((a, b) => b.localeCompare(a));

  return {
    weekStart,
    currentWeekStart,
    viewerUserId,
    entries: top10.map((entry) =>
      entry.userId === viewerUserId ? { ...entry, isViewer: true } : entry
    ),
    viewerRow: viewerInTop10 ? { ...viewerRow, rank: viewerRankEntry?.rank ?? viewerRow.rank } : viewerRow,
    availableWeeks,
  };
}
