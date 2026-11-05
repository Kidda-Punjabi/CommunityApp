import Link from "next/link";
import { formatWeekRangeLabel } from "@/lib/leaderboard/week";
import { ui } from "@/lib/ui/styles";

type WeeklyPointsCardProps = {
  points: number;
  weekStart: string;
};

export function WeeklyPointsCard({ points, weekStart }: WeeklyPointsCardProps) {
  return (
    <div className={ui.card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Weekly points
          </p>
          <p className="mt-1 font-heading text-3xl font-bold tabular-nums text-zinc-900">
            {points}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{formatWeekRangeLabel(weekStart)}</p>
        </div>
        <span className="text-3xl" aria-hidden="true">
          🏆
        </span>
      </div>
      <Link
        href="/dashboard/leaderboard"
        className="mt-4 inline-block text-sm font-semibold text-violet-600 hover:text-violet-500"
      >
        View leaderboard →
      </Link>
    </div>
  );
}
