import { loadAdminCourseInterest } from "@/app/admin/content/course-interest-actions";
import { AdminPeopleSectionShell } from "@/components/admin/admin-people-section-shell";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function AdminCourseInterestPage() {
  const { signups, error } = await loadAdminCourseInterest();

  const intermediate = signups.filter((row) => row.courseLevel === "intermediate");
  const advanced = signups.filter((row) => row.courseLevel === "advanced");

  return (
    <AdminPeopleSectionShell
      title="Course interest"
      subtitle="People who tapped Register interest on coming-soon Learn courses."
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      <InterestGroup title="Intermediate" rows={intermediate} />
      <div className="mt-6">
        <InterestGroup title="Advanced" rows={advanced} />
      </div>
    </AdminPeopleSectionShell>
  );
}

function InterestGroup({
  title,
  rows,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof loadAdminCourseInterest>>["signups"];
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-base font-semibold text-zinc-900">{title}</h2>
        <p className="text-xs font-medium text-zinc-500">
          {rows.length} {rows.length === 1 ? "person" : "people"}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 bg-white/80 px-4 py-8 text-center text-sm text-zinc-500">
          No one yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-zinc-200/70 bg-white px-4 py-3 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.07)]"
            >
              <p className="font-medium text-zinc-900">{row.displayName}</p>
              {row.email ? <p className="mt-0.5 text-sm text-zinc-500">{row.email}</p> : null}
              <p className="mt-1 text-xs text-zinc-400">{formatDate(row.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
