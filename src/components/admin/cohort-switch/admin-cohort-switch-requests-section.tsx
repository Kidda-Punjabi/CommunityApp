"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  fetchAdminCohortSwitchRequests,
  resolveAdminCohortSwitchRequest,
  retryAdminSessionSwitchCalendar,
} from "@/app/admin/cohort-switch-requests/actions";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import type { AdminCohortSwitchRequestRow } from "@/lib/admin/load-admin-cohort-switch-requests";
import { ui } from "@/lib/ui/styles";

type Filter = "pending" | "all";

export function AdminCohortSwitchRequestsSection() {
  const [rows, setRows] = useState<AdminCohortSwitchRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");

  const reload = useCallback(async () => {
    const result = await fetchAdminCohortSwitchRequests();
    setRows(result.rows);
    setError(result.error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const visible = filter === "pending" ? rows.filter((r) => r.status === "pending") : rows;

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Session switch requests</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Students who will miss one class can swap into another cohort&apos;s equivalent session
          for that week only. This is not a permanent cohort move. Approving updates both Google
          Calendar invites.
        </p>
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
            When students request a session switch from Learn or Schedule, they appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((row) => (
            <AdminSessionSwitchCard key={row.id} row={row} onResolved={() => void reload()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminSessionSwitchCard({
  row,
  onResolved,
}: {
  row: AdminCohortSwitchRequestRow;
  onResolved: () => void;
}) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resolve(decision: "approved" | "denied") {
    startTransition(async () => {
      const result = await resolveAdminCohortSwitchRequest({
        requestId: row.id,
        decision,
        adminResponse: note || undefined,
      });
      setMessage(result.success ?? result.error ?? null);
      if (result.success || result.error) onResolved();
    });
  }

  function retryCalendar() {
    startTransition(async () => {
      const result = await retryAdminSessionSwitchCalendar(row.id);
      setMessage(result.success ?? result.error ?? null);
      onResolved();
    });
  }

  const approvedUnsynced = row.status === "approved" && !row.calendarSyncedAt;

  return (
    <li className={`${ui.cardBordered} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-900">{row.studentName}</p>
          {row.studentEmail ? <p className="text-xs text-zinc-500">{row.studentEmail}</p> : null}
        </div>
        <AdminStatusPill
          tone={
            row.status === "pending"
              ? "amber"
              : row.status === "approved" && row.calendarSyncedAt
                ? "green"
                : row.status === "approved"
                  ? "amber"
                  : "zinc"
          }
        >
          {row.status === "approved" && !row.calendarSyncedAt ? "approved — calendar pending" : row.status}
        </AdminStatusPill>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-zinc-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Their class
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900">{row.fromCohortName}</p>
          {row.fromTutorName ? (
            <p className="text-xs text-zinc-500">Tutor: {row.fromTutorName}</p>
          ) : null}
          <p className="mt-1 text-sm text-zinc-600">{row.sessionWhen}</p>
        </div>
        <div className="rounded-2xl bg-violet-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Switch into
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900">{row.toCohortName}</p>
          {row.toTutorName ? (
            <p className="text-xs text-zinc-500">Tutor: {row.toTutorName}</p>
          ) : null}
          <p className="mt-1 text-sm font-medium text-violet-800">
            {row.toSessionWhen ?? "Time not stored on this request"}
          </p>
        </div>
      </div>

      <p className="text-sm text-zinc-700">{row.sessionTitle}</p>
      {row.message ? <p className="text-sm text-zinc-600">{row.message}</p> : null}

      {row.syncError ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Calendar sync error: {row.syncError}
        </p>
      ) : null}

      {row.status === "pending" ? (
        <div className="space-y-3 border-t border-zinc-100 pt-3">
          <label className="block text-sm text-zinc-700">
            Note to student (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Approving removes them from their class calendar and adds them to the requested class.
            If either Calendar update fails, the error is stored on this request.
          </p>
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
      ) : (
        <div className="space-y-2 border-t border-zinc-100 pt-3">
          {row.tutorResponse ? (
            <p className="text-sm text-zinc-500">Response: {row.tutorResponse}</p>
          ) : null}
          {row.calendarSyncedAt ? (
            <p className="text-sm text-emerald-700">Calendar updated.</p>
          ) : null}
          {approvedUnsynced ? (
            <button
              type="button"
              disabled={pending}
              onClick={retryCalendar}
              className={ui.btnPrimary}
            >
              {pending ? "Retrying…" : "Retry calendar sync"}
            </button>
          ) : null}
          {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
        </div>
      )}
    </li>
  );
}
