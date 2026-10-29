"use client";

import { ChevronRight, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CohortLeaderboard } from "@/lib/leaderboard/load-cohort-leaderboard";

type Tab = "week" | "all";

/**
 * "View cohort leaderboard" pill for the course page. Opens a sheet with the
 * group ranked by this week's points or by all-time XP.
 */
export function CohortLeaderboardButton({
  board,
  viewerId,
}: {
  board: CohortLeaderboard;
  viewerId: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("week");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rows = useMemo(() => {
    const key = tab === "week" ? "weeklyPoints" : "totalXp";
    const sorted = [...board.entries].sort(
      (a, b) => b[key] - a[key] || a.name.localeCompare(b.name)
    );
    return sorted.map((entry) => {
      const value = entry[key];
      const rank = sorted.filter((other) => other[key] > value).length + 1;
      const tied = sorted.filter((other) => other[key] === value).length > 1;
      return { ...entry, rank, tied };
    });
  }, [board.entries, tab]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 text-[13px] font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
      >
        <Trophy className="h-4 w-4 text-amber-600" aria-hidden />
        View cohort leaderboard
        <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cohort-leaderboard-title"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 rounded-t-3xl bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2.5 shadow-xl sm:rounded-3xl sm:pt-5"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-zinc-300 sm:hidden" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="cohort-leaderboard-title"
                  className="font-heading text-lg font-bold text-zinc-900"
                >
                  {board.cohortName ? `${board.cohortName} leaderboard` : "Cohort leaderboard"}
                </h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Points come from games and practice.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close leaderboard"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div role="tablist" className="flex gap-1 rounded-xl bg-zinc-100 p-1">
              {(
                [
                  ["week", "This week"],
                  ["all", "All time"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`min-h-10 flex-1 rounded-lg text-[13px] font-semibold ${
                    tab === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <ol className="-mx-1 flex-1 space-y-0.5 overflow-y-auto">
              {rows.map((entry) => {
                const isViewer = entry.userId === viewerId;
                const gold = entry.rank === 1 && !entry.tied && entry[tab === "week" ? "weeklyPoints" : "totalXp"] > 0;
                return (
                  <li
                    key={entry.userId}
                    className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 ${
                      isViewer ? "bg-violet-50" : ""
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        gold ? "bg-amber-300 text-amber-950" : "text-zinc-500"
                      }`}
                    >
                      {entry.tied ? "=" : ""}
                      {entry.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">
                      {entry.name}
                      {isViewer ? <span className="font-normal text-zinc-500"> (you)</span> : null}
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums text-violet-700">
                        {tab === "week"
                          ? `${entry.weeklyPoints} pts`
                          : `${entry.totalXp.toLocaleString("en-GB")} XP`}
                      </span>
                      <span className="block text-xs tabular-nums text-zinc-500">
                        {tab === "week"
                          ? `${entry.totalXp.toLocaleString("en-GB")} XP total`
                          : `${entry.weeklyPoints} pts this week`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : null}
    </>
  );
}
