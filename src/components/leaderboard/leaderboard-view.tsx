"use client";

import { BackLink } from "@/components/navigation/back-link";
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
        {entry.points.toLocaleString("en-GB")} XP
      </span>
    </li>
  );
}

export function LeaderboardView({ data }: LeaderboardViewProps) {
  const router = useRouter();
  const allTime = data.mode === "all";
  const isCurrentWeek = data.weekStart === data.currentWeekStart;
  const canGoNewer = !isCurrentWeek;
  const viewerInList = data.entries.some((entry) => entry.userId === data.viewerUserId);

  function navigateToWeek(weekStart: string) {
    router.push(`/dashboard/leaderboard?week=${weekStart}`);
  }

  return (
    <div className={ui.page}>
      <BackLink fallbackHref="/dashboard/community#leaderboard" className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to Community</BackLink>

      <div className="mt-4 mb-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-zinc-900">Leaderboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {allTime
            ? "The top 10 members by all the XP they've ever earned."
            : "The top 10 members by XP earned this week. Every bit of XP adds to your all-time total too."}
        </p>
      </div>

      <div role="tablist" aria-label="Leaderboard period" className="mb-4 flex rounded-full border border-zinc-200 bg-zinc-100 p-1">
        {(
          [
            ["week", "This week", "/dashboard/leaderboard"],
            ["all", "All time", "/dashboard/leaderboard?view=all"],
          ] as const
        ).map(([key, label, href]) => {
          const active = data.mode === key;
          return (
            <Link
              key={key}
              href={href}
              role="tab"
              aria-selected={active}
              className={`flex-1 rounded-full px-3 py-2 text-center text-sm font-semibold transition ${
                active ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {allTime ? null : (
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
      )}

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
            {allTime ? "No one has XP yet." : "No one has earned XP yet this week. Be the first!"}
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
