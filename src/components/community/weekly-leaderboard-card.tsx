import { UserAvatar } from "@/components/profile/user-avatar";
import { EyebrowLabel, HubCard, HubGhostLink } from "@/components/ui/hub-primitives";
import type { LeaderboardData, LeaderboardEntry } from "@/lib/leaderboard/load-leaderboard";
import { formatWeekRangeLabel } from "@/lib/leaderboard/week";

type WeeklyLeaderboardCardProps = {
  data: LeaderboardData;
};

function getPreviewRows(data: LeaderboardData): LeaderboardEntry[] {
  const top3 = data.entries.slice(0, 3);
  const viewerInTop3 = top3.some((entry) => entry.userId === data.viewerUserId);

  if (viewerInTop3) {
    return top3;
  }

  if (top3.length === 0) {
    return [data.viewerRow];
  }

  return [...top3, data.viewerRow];
}

function LeaderboardPreviewRow({ entry }: { entry: LeaderboardEntry }) {
  const displayName = entry.isViewer ? "You" : entry.displayName;

  return (
    <div
      className={`flex items-center gap-3 py-3 ${
        entry.isViewer ? "rounded-lg bg-violet-50 px-2 -mx-2" : ""
      }`}
    >
      <span className="w-5 shrink-0 text-sm font-medium tabular-nums text-zinc-500">
        {entry.rank ?? "—"}
      </span>
      <UserAvatar
        profile={{
          full_name: entry.fullName,
          preferred_name: entry.preferredName,
          avatar_url: entry.avatarUrl,
        }}
        level={entry.learnerLevel}
        size="xs"
      />
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{displayName}</p>
      <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-900">
        {entry.points} pts
      </span>
    </div>
  );
}

export function WeeklyLeaderboardCard({ data }: WeeklyLeaderboardCardProps) {
  const rows = getPreviewRows(data);

  return (
    <HubCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <EyebrowLabel>Weekly leaderboard</EyebrowLabel>
          <p className="mt-1 text-sm text-zinc-600">{formatWeekRangeLabel(data.weekStart)}</p>
        </div>
        <span className="text-xl" aria-hidden="true">
          🏆
        </span>
      </div>

      {rows.length > 0 ? (
        <div className="mt-2 divide-y divide-zinc-100">
          {rows.map((entry) => (
            <LeaderboardPreviewRow key={entry.userId} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          No points yet this week — practise to climb the board.
        </p>
      )}

      <div className="mt-3 border-t border-zinc-100 pt-3">
        <HubGhostLink href="/dashboard/leaderboard">View full leaderboard →</HubGhostLink>
      </div>
    </HubCard>
  );
}
