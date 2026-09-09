import { adminHubCardClass } from "@/components/admin/admin-hub-list";
import { cn } from "@/lib/ui/styles";

type AdminStatsBarProps = {
  courses: number;
  membersEnrolled: number;
  cohorts: number;
  staff: number;
};

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className={cn(adminHubCardClass(), "px-3 py-3.5 text-center sm:px-4")}>
      <p className="text-lg font-medium tabular-nums text-zinc-900">{value}</p>
      <p className="mt-0.5 text-[13px] text-zinc-500">{label}</p>
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard value={courses} label="Courses" />
      <StatCard value={membersEnrolled} label="Members enrolled" />
      <StatCard value={cohorts} label="Cohorts" />
      <StatCard value={staff} label="Staff" />
    </div>
  );
}
