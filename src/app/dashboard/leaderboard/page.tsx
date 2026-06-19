import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { loadLeaderboard } from "@/lib/leaderboard/load-leaderboard";
import { getCurrentWeekStart, isFutureWeek } from "@/lib/leaderboard/week";
import { createClient } from "@/lib/supabase/server";

type LeaderboardPageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const currentWeekStart = getCurrentWeekStart();
  const requestedWeek = params.week?.slice(0, 10);
  const weekStart =
    requestedWeek && !isFutureWeek(requestedWeek, currentWeekStart)
      ? requestedWeek
      : currentWeekStart;

  const data = await loadLeaderboard(supabase, weekStart, user!.id);

  return <LeaderboardView data={data} />;
}
