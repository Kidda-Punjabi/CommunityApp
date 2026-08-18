import Link from "next/link";
import { AdminTutorOverviewPanel } from "@/components/admin/admin-tutor-overview-panel";
import { ui } from "@/lib/ui/styles";

export default function AdminTutorOverviewPage() {
  return (
    <div className={ui.page}>
      <Link
        href="/admin/content"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to Admin home
      </Link>

      <div className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Tutor overview</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Capacity, upcoming lessons, and calendar connection status for each tutor.
          </p>
        </div>
        <Link href="/admin/content/calendar" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          Open calendar view →
        </Link>
        <Link href="/admin/tutor-hours" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          Tutor hours →
        </Link>
      </div>

      <AdminTutorOverviewPanel />
    </div>
  );
}
