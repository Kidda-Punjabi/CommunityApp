import { HubCard } from "@/components/ui/hub-primitives";

type AdminStatsBarProps = {
  courses: number;
  membersEnrolled: number;
  cohorts: number;
  staff: number;
};

function StatColumn({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 flex-1 px-1 text-center">
      <p className="text-lg font-medium tabular-nums text-zinc-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

export function AdminStatsBar({
  courses,
  membersEnrolled,
  cohorts,
  staff,
}: AdminStatsBarProps) {
  return (
    <HubCard className="px-4 py-4 sm:px-6">
      <div className="flex items-stretch justify-between divide-x divide-zinc-100">
        <StatColumn value={courses} label="Courses" />
        <StatColumn value={membersEnrolled} label="Members enrolled" />
        <StatColumn value={cohorts} label="Cohorts" />
        <StatColumn value={staff} label="Staff" />
      </div>
    </HubCard>
  );
}
