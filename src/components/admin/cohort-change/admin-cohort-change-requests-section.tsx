"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  fetchAdminCohortChangeRequests,
  resolveAdminCohortChangeRequest,
} from "@/app/admin/cohort-change-requests/actions";
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

function formatFeeAmount(amount: number | null): string {
  if (amount == null) return "none";
  return `£${amount}`;
}

export function AdminCohortChangeRequestsSection() {
  const [rows, setRows] = useState<AdminCohortChangeRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const reload = useCallback(async () => {
    const result = await fetchAdminCohortChangeRequests();
    setRows(result.rows);
    setError(result.error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const visible = useMemo(
    () => (filter === "pending" ? rows.filter((row) => row.status === "pending") : rows),
    [filter, rows]
  );

  return (
    <div className={ui.page}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/cohorts-hub"
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            ← Cohorts
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
        <ul className="space-y-4">
          {visible.map((row) => (
            <AdminCohortChangeCard key={row.id} row={row} onResolved={() => void reload()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminCohortChangeCard({
  row,
  onResolved,
}: {
  row: AdminCohortChangeRequestRow;
  onResolved: () => void;
}) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resolve(decision: "approved" | "denied") {
    startTransition(async () => {
      const result = await resolveAdminCohortChangeRequest({
        requestId: row.id,
        decision,
        adminNotes: note || undefined,
      });
      setMessage(result.success ?? result.error ?? null);
      if (result.success) onResolved();
    });
  }

  return (
    <li className={`${ui.cardBordered} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/admin/cohort-change-requests/${row.id}`}
            className="font-semibold text-zinc-900 hover:text-violet-700"
          >
            {row.studentName}
          </Link>
          {row.studentEmail ? <p className="text-xs text-zinc-500">{row.studentEmail}</p> : null}
        </div>
        <AdminStatusPill tone={statusTone(row.status)}>{row.status}</AdminStatusPill>
      </div>

      <div className="rounded-2xl bg-zinc-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          From course → To course
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-900">
          {row.fromCourseName} → {row.toCourseName}
        </p>
      </div>

      {row.reason ? <p className="text-sm text-zinc-700">{row.reason}</p> : null}

      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
        <span>Fee {formatFeeAmount(row.feeAmount)}</span>
        <AdminStatusPill tone={feeTone(row.feeStatus)}>{row.feeStatus}</AdminStatusPill>
        <span className="text-xs text-zinc-400">Logged {formatDate(row.createdAt)}</span>
      </div>

      {row.status === "pending" ? (
        <div className="space-y-3 border-t border-zinc-100 pt-3">
          <label className="block text-sm text-zinc-700">
            Admin notes (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => resolve("approved")}
              className={ui.btnPrimary}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => resolve("denied")}
              className={ui.btnGhost}
            >
              Decline
            </button>
          </div>
          {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
        </div>
      ) : row.adminNotes ? (
        <p className="text-sm text-zinc-500">Notes: {row.adminNotes}</p>
      ) : null}
    </li>
  );
}
