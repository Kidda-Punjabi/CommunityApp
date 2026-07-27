"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  fetchAdminRescheduleRequests,
  fetchAlternativeSlotsForRequest,
  resolveAdminRescheduleRequest,
} from "@/app/admin/reschedule-requests/actions";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import type { AdminRescheduleRequestRow } from "@/lib/admin/load-admin-reschedule-requests";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import { ui } from "@/lib/ui/styles";

type Filter = "pending" | "all";

export function AdminRescheduleRequestsSection() {
  const [rows, setRows] = useState<AdminRescheduleRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");

  const reload = useCallback(async () => {
    const result = await fetchAdminRescheduleRequests();
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Reschedule requests</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Review student reschedule requests, pick a real available time from the tutor&apos;s
          calendar, and update the booking automatically.
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
            When students request a reschedule from Schedule, they appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((row) => (
            <AdminRescheduleCard key={row.id} row={row} onResolved={() => void reload()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminRescheduleCard({
  row,
  onResolved,
}: {
  row: AdminRescheduleRequestRow;
  onResolved: () => void;
}) {
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (row.status !== "pending") return;
    setSlotsLoading(true);
    void fetchAlternativeSlotsForRequest(
      row.tutorId,
      row.sessionStartsAt,
      row.sessionEndsAt
    ).then((result) => {
      setSlots(result.slots);
      setSlotsError(result.error ?? null);
      setSlotsLoading(false);
    });
  }, [row.status, row.tutorId, row.sessionStartsAt, row.sessionEndsAt]);

  function resolve(decision: "approved" | "denied") {
    startTransition(async () => {
      const slot = slots.find((s) => s.startsAt === selected);
      const result = await resolveAdminRescheduleRequest({
        requestId: row.id,
        decision,
        tutorResponse: note || undefined,
        newStartsAt: decision === "approved" ? slot?.startsAt : undefined,
        newEndsAt: decision === "approved" ? slot?.endsAt : undefined,
      });
      setMessage(result.success ?? result.error ?? null);
      if (result.success) onResolved();
    });
  }

  return (
    <li className={`${ui.cardBordered} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-900">{row.studentName}</p>
          {row.studentEmail ? <p className="text-xs text-zinc-500">{row.studentEmail}</p> : null}
          <p className="mt-1 text-sm text-zinc-600">
            Tutor: {row.tutorName}
            {row.cohortName ? ` · ${row.cohortName}` : ""}
          </p>
        </div>
        <AdminStatusPill tone={row.status === "pending" ? "amber" : row.status === "approved" ? "green" : "zinc"}>
          {row.status}
        </AdminStatusPill>
      </div>

      <p className="text-sm font-medium text-zinc-900">{row.sessionTitle}</p>
      <p className="text-sm text-zinc-500">
        Current: {formatSessionWhen(row.sessionStartsAt, row.sessionEndsAt)}
      </p>
      <p className="text-sm text-zinc-700">{row.message}</p>
      {row.preferredTimes ? (
        <p className="text-sm text-zinc-500">
          <span className="font-medium">Preferred:</span> {row.preferredTimes}
        </p>
      ) : null}

      {row.status === "pending" ? (
        <div className="space-y-3 border-t border-zinc-100 pt-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Available alternative times
            </label>
            {slotsLoading ? (
              <p className="text-sm text-zinc-500">Checking tutor calendar…</p>
            ) : slotsError ? (
              <p className="text-sm text-amber-700">{slotsError}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-amber-700">
                No free slots in the next 4 weeks from this tutor&apos;s availability settings.
              </p>
            ) : (
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="">Select a time…</option>
                {slots.map((slot) => (
                  <option key={slot.startsAt} value={slot.startsAt}>
                    {slot.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <label className="block text-sm text-zinc-700">
            Note to student (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !selected}
              onClick={() => resolve("approved")}
              className={ui.btnPrimary}
            >
              Approve + update calendar
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
