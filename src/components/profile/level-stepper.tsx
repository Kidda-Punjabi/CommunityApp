import { Flag } from "lucide-react";
import { PROGRESSION_TIERS } from "@/lib/progression/tiers";
import { cn } from "@/lib/ui/styles";

type LevelStepperProps = {
  currentLevel: number;
  targetTier?: number | null;
};

function levelStateLabel({
  isComplete,
  isCurrent,
  isGoal,
}: {
  isComplete: boolean;
  isCurrent: boolean;
  isGoal: boolean;
}): string {
  if (isComplete) return "Complete";
  if (isCurrent && isGoal) return "In progress · Your goal";
  if (isCurrent) return "In progress";
  if (isGoal) return "Your goal";
  return "Locked";
}

export function LevelStepper({ currentLevel, targetTier = null }: LevelStepperProps) {
  return (
    <ol className="space-y-0">
      {PROGRESSION_TIERS.map((entry, index) => {
        const isComplete = entry.tier < currentLevel;
        const isCurrent = entry.tier === currentLevel;
        const isLast = index === PROGRESSION_TIERS.length - 1;
        const isGoal = targetTier != null && entry.tier === targetTier;
        const stateLabel = levelStateLabel({ isComplete, isCurrent, isGoal });

        return (
          <li key={entry.tier} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="relative shrink-0">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                    isComplete
                      ? "bg-violet-600 text-white"
                      : isCurrent
                        ? "border-2 border-violet-600 text-violet-600"
                        : "border border-zinc-200 text-zinc-400"
                  )}
                >
                  {isComplete ? "✓" : entry.tier}
                </span>
                {isGoal ? (
                  <Flag
                    className="absolute -right-1 -top-1 h-3 w-3 fill-violet-600 text-violet-600"
                    aria-label="Your onboarding goal"
                  />
                ) : null}
              </div>
              {!isLast ? <span className="my-1 w-px flex-1 bg-zinc-200" aria-hidden="true" /> : null}
            </div>
            <div className={cn("min-w-0 flex-1", !isLast && "pb-5")}>
              <p
                className={cn(
                  "text-sm font-medium",
                  isCurrent ? "text-zinc-900" : isComplete ? "text-zinc-600" : "text-zinc-400"
                )}
              >
                {entry.name}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{stateLabel}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
