import Link from "next/link";

type StreakRescueBannerProps = {
  currentStreak: number;
};

export function StreakRescueBanner({ currentStreak }: StreakRescueBannerProps) {
  return (
    <section className="mb-6">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          Streak at risk
        </p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">
          You missed yesterday — rescue your streak today!
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Complete any lesson audio, pass a quiz at 80%+, or finish a flashcard set
          (all cards confident) to keep your{" "}
          <span className="font-semibold text-amber-800">
            {currentStreak} day streak
          </span>
          .
        </p>
        <Link
          href="/dashboard/learn"
          className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500"
        >
          Continue learning
        </Link>
      </div>
    </section>
  );
}
