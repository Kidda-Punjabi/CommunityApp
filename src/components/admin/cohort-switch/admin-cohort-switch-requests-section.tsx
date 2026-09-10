"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  fetchAdminCohortSwitchRequests,
  resolveAdminCohortSwitchRequest,
} from "@/app/admin/cohort-switch-requests/actions";
import { AdminAddCohortReschedule } from "@/components/admin/cohort-switch/admin-add-cohort-reschedule";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import type { AdminCohortSwitchRequestRow } from "@/lib/admin/load-admin-cohort-switch-requests";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";
import type { AlternateCohortOption } from "@/lib/calendar/types";
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Cohort change requests
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Students ask to join a matching alternate group session when they can&apos;t make their
          usual class. Approve or decline here — tutors do not resolve these.
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

      <AdminAddCohortReschedule onCreated={() => void reload()} />

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : visible.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">No requests</p>
          <p className="mt-2 text-sm text-zinc-500">
            When students request an alternate cohort from Learn or Schedule, they appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((row) => (
            <AdminCohortSwitchCard key={row.id} row={row} onResolved={() => void reload()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function asWeekNumberLabel(
  weekNumber: number | null,
  weeksDiffer: boolean
) {
  if (weekNumber == null) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-950 ring-2 ring-amber-500">
        ⚠ Week not set
      </span>
    );
  }

  return (
    <span className={weeksDiffer ? "font-bold text-amber-700" : undefined}>
      Week {weekNumber}
    </span>
  );
}

function buildAlternativeSuggestion(option: AlternateCohortOption): string {
  const start = new Date(option.startsAt);
  const date = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
  const time = start.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: UK_DISPLAY_TIMEZONE,
  });
  return `This time isn't available, but ${option.name} with ${option.tutorName} on ${date} at ${time} might work instead — let us know if you'd like to reschedule to that.`;
}

function AdminCohortSwitchCard({
  row,
  onResolved,
}: {
  row: AdminCohortSwitchRequestRow;
  onResolved: () => void;
}) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fromWeekMissing = row.fromWeekNumber == null;
  const toWeekMissing = Boolean(row.toSessionId) && row.toWeekNumber == null;
  const weeksDiffer =
    row.fromWeekNumber != null &&
    row.toWeekNumber != null &&
    row.fromWeekNumber !== row.toWeekNumber;
  const weekMissing = fromWeekMissing || toWeekMissing;
  const missingOn = [
    fromWeekMissing ? "current" : null,
    toWeekMissing ? "requested" : null,
  ]
    .filter(Boolean)
    .join(" and ");

  function resolve(decision: "approved" | "denied") {
    startTransition(async () => {
      const result = await resolveAdminCohortSwitchRequest({
        requestId: row.id,
        decision,
        adminResponse: note || undefined,
      });
      setMessage(result.success ?? result.error ?? null);
      if (result.success) onResolved();
    });
  }

  return (
    <li
      className={`${ui.cardBordered} space-y-3 ${
        weekMissing ? "border-amber-400 ring-2 ring-amber-300" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-900">{row.studentName}</p>
          {row.studentEmail ? <p className="text-xs text-zinc-500">{row.studentEmail}</p> : null}
        </div>
        <AdminStatusPill
          tone={
            row.status === "pending" ? "amber" : row.status === "approved" ? "green" : "zinc"
          }
        >
          {row.status}
        </AdminStatusPill>
      </div>

      {weekMissing ? (
        <p className="rounded-xl border border-amber-400 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950">
          ⚠ Week number missing on the {missingOn} session — review in Supabase before
          approving.
        </p>
      ) : null}

      {row.status === "pending" &&
      row.toSessionId &&
      !row.requestedIsCurrentCandidate &&
      !weekMissing ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          Requested session is not in the current matching list — week numbering may be wrong.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-zinc-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Current
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium text-zinc-900">
            <span>{row.fromCohortName}</span>
            <span className="text-zinc-400">·</span>
            {asWeekNumberLabel(row.fromWeekNumber, weeksDiffer)}
          </p>
          {row.fromTutorName ? (
            <p className="text-xs text-zinc-500">Tutor: {row.fromTutorName}</p>
          ) : null}
          <p className="mt-1 text-sm text-zinc-600">{row.sessionWhen}</p>
        </div>
        <div className="rounded-2xl bg-violet-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Requested
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium text-zinc-900">
            <span>{row.toCohortName}</span>
            <span className="text-zinc-400">·</span>
            {row.toSessionId ? (
              asWeekNumberLabel(row.toWeekNumber, weeksDiffer)
            ) : (
              <span className="text-xs font-medium text-zinc-500">Week not stored</span>
            )}
          </p>
          {row.toTutorName ? (
            <p className="text-xs text-zinc-500">Tutor: {row.toTutorName}</p>
          ) : null}
          <p className="mt-1 text-sm font-medium text-violet-800">
            {row.toSessionWhen ?? "Time not stored on this request"}
          </p>
          {row.status === "pending" ? (
            row.alternateCandidates.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No other matching options</p>
            ) : (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-violet-700">
                  {`Show ${row.alternateCandidates.length} other option${
                    row.alternateCandidates.length === 1 ? "" : "s"
                  }`}
                </summary>
                <ul className="mt-2 space-y-2">
                  {row.alternateCandidates.map((option) => (
                    <li
                      key={option.id}
                      className="flex items-start justify-between gap-2 rounded-xl bg-white/80 px-2.5 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{option.name}</p>
                        <p className="text-xs text-zinc-500">Tutor: {option.tutorName}</p>
                        <p className="text-xs text-zinc-600">
                          {formatSessionWhen(option.startsAt, option.endsAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-semibold text-violet-700 hover:text-violet-900"
                        onClick={() => setNote(buildAlternativeSuggestion(option))}
                      >
                        Use this
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )
          ) : null}
        </div>
      </div>

      <p className="text-sm text-zinc-700">{row.sessionTitle}</p>
      {row.message ? <p className="text-sm text-zinc-600">{row.message}</p> : null}

      {row.status === "pending" ? (
        <div className="space-y-3 border-t border-zinc-100 pt-3">
          <label className="block text-sm text-zinc-700">
            Note to student (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Approving invites the student to the alternate session calendar when possible.
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
      ) : row.tutorResponse ? (
        <p className="text-sm text-zinc-500">Response: {row.tutorResponse}</p>
      ) : null}
    </li>
  );
}
