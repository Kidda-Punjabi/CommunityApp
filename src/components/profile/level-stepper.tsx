import { PROGRESSION_TIERS } from "@/lib/progression/tiers";
import { cn } from "@/lib/ui/styles";

type LevelStepperProps = {
  currentLevel: number;
};

export function LevelStepper({ currentLevel }: LevelStepperProps) {
  return (
    <ol className="space-y-0">
      {PROGRESSION_TIERS.map((entry, index) => {
        const isComplete = entry.tier < currentLevel;
        const isCurrent = entry.tier === currentLevel;
        const isLast = index === PROGRESSION_TIERS.length - 1;

        let stateLabel = "Locked";
        if (isComplete) stateLabel = "Complete";
        else if (isCurrent) stateLabel = "In progress";

        return (
          <li key={entry.tier} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  isComplete
                    ? "bg-violet-600 text-white"
                    : isCurrent
                      ? "border-2 border-violet-600 text-violet-600"
                      : "border border-zinc-200 text-zinc-400"
                )}
              >
                {isComplete ? "✓" : entry.tier}
              </span>
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
