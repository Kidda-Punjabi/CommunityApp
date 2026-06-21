"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { LeaderboardEntry, LeaderboardData } from "@/lib/leaderboard/load-leaderboard";
import {
  formatWeekRangeLabel,
  isFutureWeek,
  shiftWeekStart,
} from "@/lib/leaderboard/week";
import { ui } from "@/lib/ui/styles";

type LeaderboardViewProps = {
  data: LeaderboardData;
};

function podiumMedal(rank: number | null): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function LeaderboardRow({
  entry,
  highlight,
  showYouLabel,
}: {
  entry: LeaderboardEntry;
  highlight?: boolean;
  showYouLabel?: boolean;
}) {
  const medal = podiumMedal(entry.rank);

  return (
    <li
      className={`flex items-center gap-3 py-3 ${
        highlight ? "rounded-2xl bg-violet-50 px-2 -mx-2" : ""
      }`}
    >
      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-zinc-400">
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
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900">
          {entry.displayName}
          {medal && (
            <span className="ml-1.5" aria-hidden="true">
              {medal}
            </span>
          )}
          {showYouLabel && (
            <span className="ml-1.5 text-xs font-semibold text-violet-600">(you)</span>
          )}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-violet-600">
        {entry.points}
      </span>
    </li>
  );
}

export function LeaderboardView({ data }: LeaderboardViewProps) {
  const router = useRouter();
  const isCurrentWeek = data.weekStart === data.currentWeekStart;
  const canGoNewer = !isCurrentWeek;
  const viewerInList = data.entries.some((entry) => entry.userId === data.viewerUserId);

  function navigateToWeek(weekStart: string) {
    router.push(`/dashboard/leaderboard?week=${weekStart}`);
  }

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/home"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to Home
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-zinc-900">
          Weekly leaderboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          The top 10 members with the most practice points this week.
        </p>
      </div>

      <div className={`mb-6 ${ui.card}`}>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigateToWeek(shiftWeekStart(data.weekStart, -1))}
            className={`${ui.btnGhost} !px-3 !py-2`}
            aria-label="Previous week"
          >
            ←
          </button>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              {isCurrentWeek ? "This week" : "Week of"}
            </p>
            <p className="font-heading text-sm font-semibold text-zinc-900">
              {formatWeekRangeLabel(data.weekStart)}
            </p>
          </div>
          <button
            type="button"
            disabled={!canGoNewer}
            onClick={() => {
              const next = shiftWeekStart(data.weekStart, 1);
              if (!isFutureWeek(next, data.currentWeekStart)) {
                navigateToWeek(next);
              }
            }}
            className={`${ui.btnGhost} !px-3 !py-2 disabled:opacity-30`}
            aria-label="Next week"
          >
            →
          </button>
        </div>
      </div>

      <div className={ui.card}>
        {data.entries.length > 0 ? (
          <ol className="divide-y divide-zinc-100">
            {data.entries.map((entry) => (
              <LeaderboardRow
                key={entry.userId}
                entry={entry}
                highlight={entry.userId === data.viewerUserId}
                showYouLabel={entry.userId === data.viewerUserId}
              />
            ))}
          </ol>
        ) : (
          <p className="py-4 text-center text-sm text-zinc-500">
            No one has points yet this week — be the first!
          </p>
        )}

        {!viewerInList && (
          <>
            <div className="border-t border-dashed border-zinc-200" />
            <ol>
              <LeaderboardRow entry={data.viewerRow} highlight showYouLabel />
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
