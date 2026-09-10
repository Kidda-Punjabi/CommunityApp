"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  fetchAdminCohortChangeRequest,
  updateAdminCohortChangeRequest,
} from "@/app/admin/cohort-change-requests/actions";
import { inputClass, labelClass } from "@/app/admin/content/components/ui";
import { AdminStatusPill } from "@/components/admin/admin-filter-pills";
import {
  COHORT_CHANGE_FEE_STATUSES,
  COHORT_CHANGE_STATUSES,
  type AdminCohortChangeRequestRow,
  type CohortChangeFeeStatus,
  type CohortChangeRequestStatus,
} from "@/lib/admin/cohort-change-request-types";
import { ui } from "@/lib/ui/styles";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function AdminCohortChangeRequestDetail({ requestId }: { requestId: string }) {
  const [row, setRow] = useState<AdminCohortChangeRequestRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CohortChangeRequestStatus>("pending");
  const [feeStatus, setFeeStatus] = useState<CohortChangeFeeStatus>("unpaid");
  const [adminNotes, setAdminNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void fetchAdminCohortChangeRequest(requestId).then((result) => {
      if (cancelled) return;
      setRow(result.row);
      setError(result.error ?? null);
      if (result.row) {
        setStatus(result.row.status);
        setFeeStatus(result.row.feeStatus);
        setAdminNotes(result.row.adminNotes ?? "");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateAdminCohortChangeRequest({
        requestId,
        status,
        feeStatus,
        adminNotes,
      });
      setMessage(result.success ?? result.error ?? null);
      if (result.success) {
        const refreshed = await fetchAdminCohortChangeRequest(requestId);
        setRow(refreshed.row);
        if (refreshed.row) {
          setStatus(refreshed.row.status);
          setFeeStatus(refreshed.row.feeStatus);
          setAdminNotes(refreshed.row.adminNotes ?? "");
        }
      }
    });
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link
          href="/admin/cohort-change-requests"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Cohort switch requests
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
          Cohort switch request
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Update status and fee notes. Marking completed does not move the enrollment.
        </p>
      </div>

      {loading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {row ? (
        <div className="max-w-xl space-y-4">
          <div className={ui.cardBordered}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-zinc-900">{row.studentName}</p>
                {row.studentEmail ? <p className="text-xs text-zinc-500">{row.studentEmail}</p> : null}
              </div>
              <AdminStatusPill tone={row.status === "pending" ? "amber" : "green"}>
                {row.status}
              </AdminStatusPill>
            </div>
            <p className="mt-3 text-sm text-zinc-800">
              {row.fromCourseName} → {row.toCourseName}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Logged {formatDate(row.createdAt)}</p>
            {row.reason ? <p className="mt-3 text-sm text-zinc-700">{row.reason}</p> : null}
            <p className="mt-3 text-sm text-zinc-600">
              Fee: {row.feeAmount == null ? "none" : `£${row.feeAmount}`} · {row.feeStatus}
            </p>
          </div>

          <form
            className={`${ui.cardBordered} space-y-4`}
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <label className={labelClass}>
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as CohortChangeRequestStatus)}
                className={inputClass}
              >
                {COHORT_CHANGE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Fee status
              <select
                value={feeStatus}
                onChange={(event) => setFeeStatus(event.target.value as CohortChangeFeeStatus)}
                className={inputClass}
              >
                {COHORT_CHANGE_FEE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Admin notes
              <textarea
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </label>

            {message ? <p className="text-sm text-zinc-600">{message}</p> : null}

            <button type="submit" disabled={pending} className={ui.btnPrimary}>
              {pending ? "Saving…" : "Save"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
