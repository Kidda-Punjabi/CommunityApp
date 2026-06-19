import type { UserProgression } from "@/lib/progression/load-user-progression";
import { PROGRESSION_TIERS } from "@/lib/progression/tiers";
import { ui } from "@/lib/ui/styles";

type ProgressionCardProps = {
  progression: UserProgression;
};

export function ProgressionCard({ progression }: ProgressionCardProps) {
  const { tier, nextTier, score, isEstimated, breakdown } = progression;
  const nextThreshold = nextTier?.minScore ?? 100;
  const progressLabel = nextTier
    ? `${score}/${nextThreshold} to ${nextTier.name}`
    : "Maximum tier reached";

  return (
    <div className={ui.card}>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your level</p>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-xl font-bold text-zinc-900">
            Tier {tier.tier}: {tier.name}
          </p>
          {isEstimated && (
            <p className="mt-1 text-xs text-violet-600">Based on your own estimate</p>
          )}
        </div>
        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
          {score}/100
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{tier.description}</p>

      {(progression.goalMotivationLabel || progression.targetTierMeta) && (
        <p className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <span className="font-medium">Your goal:</span>{" "}
          {progression.goalMotivationLabel ?? "Learn Punjabi"}
          {progression.targetTierMeta
            ? ` — aiming for ${progression.targetTierMeta.name}`
            : ""}
        </p>
      )}

      {nextTier && (
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{progressLabel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-violet-600 transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, ((score - tier.minScore) / (nextThreshold - tier.minScore)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-1">
        {PROGRESSION_TIERS.map((entry) => {
          const isCurrent = entry.tier === tier.tier;
          const isTarget = entry.tier === progression.targetTier;
          return (
            <li
              key={entry.tier}
              className={`rounded-full px-3 py-1.5 text-xs ${
                isCurrent
                  ? "bg-violet-600 font-semibold text-white"
                  : isTarget
                    ? "border border-violet-300 bg-violet-50 font-medium text-violet-800"
                    : "text-zinc-500"
              }`}
            >
              {entry.tier}. {entry.name}
              {isTarget && !isCurrent ? " (goal)" : ""}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-4 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wider text-zinc-400">Score breakdown</p>
        <p>
          Quiz average:{" "}
          {breakdown.avgQuizScorePct != null ? `${breakdown.avgQuizScorePct}%` : "—"}
        </p>
        <p>
          Game accuracy:{" "}
          {breakdown.avgGameAccuracyPct != null ? `${breakdown.avgGameAccuracyPct}%` : "—"}
        </p>
        <p>
          Lessons completed: {breakdown.lessonsCompleted}/{breakdown.lessonsTotal}
        </p>
        <p>
          Flashcards confident: {breakdown.flashcardsConfident}/{breakdown.flashcardsTotal}
        </p>
      </div>
    </div>
  );
}
