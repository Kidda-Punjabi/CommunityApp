import { AdminMetricCard } from "@/components/admin/admin-metric-card";

type AdminStatsBarProps = {
  courses: number;
  membersEnrolled: number;
  cohorts: number;
  staff: number;
  loading?: boolean;
};

const stats = [
  { key: "courses", label: "Courses" },
  { key: "membersEnrolled", label: "Members enrolled" },
  { key: "cohorts", label: "Cohorts" },
  { key: "staff", label: "Staff" },
] as const;

export function AdminStatsBar({
  courses,
  membersEnrolled,
  cohorts,
  staff,
  loading = false,
}: AdminStatsBarProps) {
  const values = { courses, membersEnrolled, cohorts, staff };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-busy={loading}>
      {stats.map((stat) => (
        <AdminMetricCard
          key={stat.key}
          label={stat.label}
          value={values[stat.key]}
          loading={loading}
        />
      ))}
    </div>
  );
}
