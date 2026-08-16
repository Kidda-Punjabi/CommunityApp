import { displayKidsCohortName } from "@/lib/learning/kids-cohort-display";

type KidsCohortPlacementCardProps = {
  cohortName: string | null;
  weeklyLabel: string | null;
  startDateLabel: string | null;
  gated: boolean;
};

export function KidsCohortPlacementCard({
  cohortName,
  weeklyLabel,
  startDateLabel,
  gated,
}: KidsCohortPlacementCardProps) {
  const name = displayKidsCohortName(cohortName);

  return (
    <div className="mb-6 rounded-xl border border-violet-100 bg-violet-50 px-4 py-4 text-sm text-violet-900">
      {name ? <p className="font-semibold">{name}</p> : <p className="font-semibold">Your class</p>}
      {weeklyLabel ? <p className="mt-1 text-violet-800">{weeklyLabel}</p> : null}
      {gated && startDateLabel ? (
        <p className="mt-1 text-violet-800">Starts {startDateLabel}</p>
      ) : null}
      <p className="mt-2 text-violet-800">
        You can look through every lesson. Content stays locked until your class covers it.
      </p>
    </div>
  );
}
