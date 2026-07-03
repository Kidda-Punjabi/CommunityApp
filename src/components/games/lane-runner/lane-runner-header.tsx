"use client";

import Link from "next/link";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { LANE_RUNNER_DISPLAY_NAME, LANE_RUNNER_LIVES } from "@/lib/games/lane-runner/config";

type LaneRunnerHeaderProps = {
  lives: number;
  lifetimeCoins: number;
  streak: number;
  learnerLevel: number | null;
  coinPopAmount?: number | null;
};

function HeartRow({ lives }: { lives: number }) {
  return (
    <div className="flex items-center gap-0.5 text-base leading-none" aria-label={`${lives} lives`}>
      {Array.from({ length: LANE_RUNNER_LIVES }).map((_, index) => (
        <span key={index} aria-hidden>
          {index < lives ? "❤️" : "🖤"}
        </span>
      ))}
    </div>
  );
}

export function LaneRunnerHeader({
  lives,
  lifetimeCoins,
  streak,
  learnerLevel,
  coinPopAmount,
}: LaneRunnerHeaderProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-sky-100 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <HeartRow lives={lives} />
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-bold text-zinc-900">{LANE_RUNNER_DISPLAY_NAME}</p>
          {learnerLevel ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">
              Level {learnerLevel}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div
            className={`relative flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-900 ${
              coinPopAmount ? "lane-runner-coin-counter-pulse" : ""
            }`}
          >
            <span aria-hidden>○</span>
            <span className="tabular-nums">{lifetimeCoins}</span>
            {coinPopAmount ? (
              <span className="lane-runner-coin-pop absolute -top-4 right-0 text-xs font-bold text-amber-700">
                +{coinPopAmount}
              </span>
            ) : null}
          </div>
          <div className="rounded-full bg-violet-100 px-2.5 py-0.5 tabular-nums text-violet-800">
            🔥 {streak}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LaneRunnerReadyScreen({
  canStart,
  loadError,
  onStart,
}: {
  canStart: boolean;
  loadError: string | null;
  onStart: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to games
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">{LANE_RUNNER_DISPLAY_NAME}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Endless run — dodge into the right lane, grab coins, and spell KIDDA. You have three
          lives; speed ramps gently over time.
        </p>
      </div>
      {loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load flashcards: {loadError}
        </p>
      ) : null}
      {!canStart && !loadError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Need at least 3 flashcards to play.
        </p>
      ) : null}
      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        Start run
      </button>
    </div>
  );
}
