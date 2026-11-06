"use client";

import { Trophy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CohortLeaderboard } from "@/lib/leaderboard/load-cohort-leaderboard";

type Tab = "week" | "all";

/**
 * "View cohort leaderboard" pill for the course page. Opens a sheet with the
 * group ranked by the last 7 days of points or by all-time XP.
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

  const metric = tab === "week" ? "weeklyPoints" : "totalXp";
  const unit = tab === "week" ? "pts" : "XP";
  const top3 = rows.length >= 3 ? rows.slice(0, 3) : [];
  const podium = top3.length ? [top3[1], top3[0], top3[2]] : [];
  const listed = rows.slice(top3.length);
  const viewerIndex = rows.findIndex((entry) => entry.userId === viewerId);
  const ahead = viewerIndex > 0 ? rows[viewerIndex - 1] : null;
  const gap = ahead && viewerIndex >= 0 ? ahead[metric] - rows[viewerIndex][metric] : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View cohort leaderboard"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white hover:bg-zinc-50"
      >
        <Trophy className="h-5 w-5 text-amber-600" aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#1F1640]/55 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cohort-leaderboard-title"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-zinc-50 shadow-xl sm:rounded-[28px]"
          >
            <div className="shrink-0 rounded-b-[28px] bg-[#5B21B6] px-4 pt-4 text-white">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 id="cohort-leaderboard-title" className="truncate font-heading text-2xl font-extrabold tracking-tight">
                    {board.cohortName ?? "Your cohort"}
                  </h2>
                  <p className="text-[13px] font-semibold">Leaderboard</p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close leaderboard"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <div role="tablist" className="mt-3 flex gap-1 rounded-xl bg-white/15 p-1">
                {(
                  [
                    ["week", "Last 7 days"],
                    ["all", "All time"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                    className={`min-h-10 flex-1 rounded-lg text-[13px] font-bold ${
                      tab === value ? "bg-white text-[#5B21B6]" : "text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {podium.length ? (
                <div className="mt-4 grid grid-cols-3 items-end gap-2">
                  {podium.map((entry, index) => {
                    const place = [2, 1, 3][index];
                    const medal = ["#E1E3E8", "#FFD84F", "#F2C9A5"][index];
                    return (
                      <div key={entry.userId} className="flex min-w-0 flex-col items-center gap-0.5">
                        <span
                          className={`flex items-center justify-center rounded-full border-4 bg-white font-extrabold text-[#5B21B6] ${
                            place === 1 ? "h-[68px] w-[68px] text-xl" : "h-14 w-14 text-lg"
                          }`}
                          style={{ borderColor: medal }}
                        >
                          {entry.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="max-w-full truncate text-[15px] font-extrabold">{entry.name}</span>
                        <span className="text-[13px] font-semibold tabular-nums">
                          {entry[metric].toLocaleString("en-GB")} {unit}
                        </span>
                        <span
                          className={`mt-1 flex w-full items-center justify-center rounded-t-[14px] text-[26px] font-extrabold text-[#1F1640] ${
                            place === 1 ? "h-[86px]" : place === 2 ? "h-[58px]" : "h-11"
                          }`}
                          style={{ background: medal }}
                        >
                          {entry.tied ? "=" : ""}
                          {entry.rank}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-4" />
              )}
            </div>

            <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
              {listed.map((entry) => {
                const isViewer = entry.userId === viewerId;
                return (
                  <li
                    key={entry.userId}
                    className={`flex min-h-[52px] items-center gap-3 rounded-[18px] border px-3.5 py-2 ${
                      isViewer ? "border-2 border-violet-600 bg-violet-100" : "border-[#ECE9F5] bg-white"
                    }`}
                  >
                    <span className={`w-7 shrink-0 text-center font-extrabold tabular-nums ${isViewer ? "text-[#5B21B6]" : "text-zinc-600"}`}>
                      {entry.tied ? "=" : ""}
                      {entry.rank}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold text-zinc-900">{isViewer ? "You" : entry.name}</span>
                      {isViewer && ahead && gap > 0 ? (
                        <span className="block truncate text-xs font-semibold text-zinc-700">
                          {gap.toLocaleString("en-GB")} {unit} to pass {ahead.name}
                        </span>
                      ) : null}
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
                          : `${entry.weeklyPoints} pts in 7 days`}
                      </span>
                    </span>
                  </li>
                );
              })}
              {top3.some((entry) => entry.userId === viewerId) ? (
                <li className="py-1 text-center text-sm font-bold text-violet-700">You&apos;re on the podium</li>
              ) : null}
            </ol>
          </div>
        </div>
      ) : null}
    </>
  );
}
