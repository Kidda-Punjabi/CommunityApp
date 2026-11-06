import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { loadLeaderboard } from "@/lib/leaderboard/load-leaderboard";
import { getCurrentWeekStart, isFutureWeek } from "@/lib/leaderboard/week";

type LeaderboardPageProps = {
  searchParams: Promise<{ week?: string; view?: string }>;
};

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const { user, supabase } = await requireNoKidCommunityAccess();

  const params = await searchParams;
  const currentWeekStart = getCurrentWeekStart();
  const requestedWeek = params.week?.slice(0, 10);
  const weekStart =
    requestedWeek && !isFutureWeek(requestedWeek, currentWeekStart)
      ? requestedWeek
      : currentWeekStart;

  const mode = params.view === "all" ? "all" : "week";
  const data = await loadLeaderboard(supabase, weekStart, user.id, mode);

  return <LeaderboardView data={data} />;
}
