"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchAdminCohortChangeRequests } from "@/app/admin/cohort-change-requests/actions";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import type {
  AdminCohortChangeRequestRow,
  CohortChangeFeeStatus,
  CohortChangeRequestStatus,
} from "@/lib/admin/cohort-change-request-types";
import { ui } from "@/lib/ui/styles";

type Filter = "pending" | "all";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function statusTone(status: CohortChangeRequestStatus) {
  if (status === "pending") return "amber" as const;
  if (status === "approved" || status === "completed") return "green" as const;
  return "zinc" as const;
}

function feeTone(status: CohortChangeFeeStatus) {
  if (status === "unpaid") return "amber" as const;
  if (status === "paid") return "green" as const;
  return "zinc" as const;
}

export function AdminCohortChangeRequestsSection() {
  const [rows, setRows] = useState<AdminCohortChangeRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");

  useEffect(() => {
    let cancelled = false;
    void fetchAdminCohortChangeRequests().then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const visible = useMemo(
    () => (filter === "pending" ? rows.filter((row) => row.status === "pending") : rows),
    [filter, rows]
  );

  return (
    <div className={ui.page}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-medium text-violet-600 hover:text-violet-500">
            ← Admin home
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
            Cohort switch requests
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Paper trail for course/level changes (e.g. Beginners → Intermediate). Logging here does
            not move enrollments or take payment. Group session slot swaps stay on Group session
            reschedules.
          </p>
        </div>
        <Link href="/admin/cohort-change-requests/new" className={ui.btnPrimary}>
          New request
        </Link>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <AdminFilterPill
          label={`Pending (${pendingCount})`}
          active={filter === "pending"}
          onClick={() => setFilter("pending")}
        />
        <AdminFilterPill
          label={`All (${rows.length})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : visible.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">No requests</p>
          <p className="mt-2 text-sm text-zinc-500">
            Log a course/level change when a student emails hello@kidda.app and ops handles it.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
          <table className="min-w-[48rem] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-3 py-3">From → to</th>
                <th className="px-3 py-3">Fee</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/cohort-change-requests/${row.id}`}
                      className="font-semibold text-violet-600 hover:text-violet-500"
                    >
                      {row.studentName}
                    </Link>
                    {row.studentEmail ? (
                      <p className="text-xs text-zinc-500">{row.studentEmail}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-zinc-800">
                    {row.fromCourseName} → {row.toCourseName}
                  </td>
                  <td className="px-3 py-3">
                    <AdminStatusPill tone={feeTone(row.feeStatus)}>{row.feeStatus}</AdminStatusPill>
                  </td>
                  <td className="px-3 py-3">
                    <AdminStatusPill tone={statusTone(row.status)}>{row.status}</AdminStatusPill>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
                    {formatDate(row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
