import type { CohortLeaderboard } from "@/lib/leaderboard/load-cohort-leaderboard";

/**
 * "Your group" leaderboard for a beginners cohort: shown to students in the course
 * and to tutors on the class page. Students see the last 7 days; tutors see this week.
 */
export function CohortLeaderboardCard({
  board,
  viewerId = null,
  audience,
}: {
  board: CohortLeaderboard;
  viewerId?: string | null;
  audience: "student" | "tutor";
}) {
  const leaderPoints = board.entries[0]?.weeklyPoints ?? 0;
  const recent = board.pointsWindow === "rolling7";
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-bold text-zinc-900">
          {audience === "student" ? "Your group" : "Group leaderboard"}
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {recent ? "Last 7 days" : "This week"}
        </span>
      </div>
      {board.cohortName ? <p className="mt-0.5 text-sm text-zinc-500">{board.cohortName}</p> : null}
      <ol className="mt-3 divide-y divide-zinc-100">
        {board.entries.map((entry) => {
          const isViewer = entry.userId === viewerId;
          const top = entry.rank === 1 && entry.weeklyPoints > 0;
          return (
            <li
              key={entry.userId}
              className={`flex items-center gap-3 py-2.5 ${isViewer ? "-mx-2 rounded-2xl bg-violet-50 px-2" : ""}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  top ? "bg-amber-300 text-amber-950" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {entry.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">
                {entry.name}
                {isViewer ? <span className="font-normal text-zinc-500"> (you)</span> : null}
              </span>
              <span className="text-right">
                <span className="block text-sm font-bold tabular-nums text-violet-700">{entry.weeklyPoints} XP</span>
                <span className="block text-xs tabular-nums text-zinc-500">{entry.totalXp} XP total</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-zinc-500">
        {audience === "tutor"
          ? leaderPoints > 0
            ? recent
              ? "Give the last 7 days' top learner a shout-out in class."
              : "Give this week's top learner a shout-out in class."
            : recent
              ? "No XP in the last 7 days. Nudge the group to play a few games."
              : "No XP yet this week. Nudge the group to play a few games."
          : recent
            ? "XP from games, Practice, lessons and live sessions over the last 7 days. Earn some to climb the board."
            : "XP comes from games, Practice, lessons and live sessions. Earn some to climb the board."}
      </p>
    </section>
  );
}
