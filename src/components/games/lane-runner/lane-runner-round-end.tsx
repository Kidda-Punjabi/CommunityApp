"use client";

import Link from "next/link";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";
import { LANE_RUNNER_DISPLAY_NAME } from "@/lib/games/lane-runner/config";
import type { LaneRunnerRoundSummary } from "@/lib/games/lane-runner/types";

type LaneRunnerRoundEndProps = {
  summary: LaneRunnerRoundSummary;
  onPlayAgain: () => void;
};

export function LaneRunnerRoundEnd({ summary, onPlayAgain }: LaneRunnerRoundEndProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
        <div className="bg-sky-100 px-5 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Run over
          </p>
          <h2 className="mt-1 text-xl font-bold text-zinc-900">{LANE_RUNNER_DISPLAY_NAME}</h2>
        </div>
        <div className="space-y-4 px-5 py-5">
          <dl className="grid grid-cols-1 gap-3 text-center">
            <div className="rounded-xl bg-zinc-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Final streak
              </dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
                {summary.finalStreak}
              </dd>
            </div>
            <div className="rounded-xl bg-zinc-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Best streak this run
              </dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-violet-700">
                {summary.bestStreak}
              </dd>
            </div>
            <div className="rounded-xl bg-zinc-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Coins earned this run
              </dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
                {summary.coinsEarnedRound}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Play again
          </button>
          <Link
            href={GAMES_HUB_HREF}
            className="block w-full rounded-lg px-4 py-2 text-center text-sm font-semibold text-violet-600 hover:text-violet-500"
          >
            Back to games
          </Link>
        </div>
      </div>
    </div>
  );
}
