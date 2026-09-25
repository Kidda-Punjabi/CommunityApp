"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  dismissMissingRecording,
  fetchMissingRecordings,
  saveMissingRecordingLink,
  saveMissingRecordingUpload,
  undismissMissingRecording,
} from "@/app/admin/recordings/missing/actions";
import { AdminFilterPill } from "@/components/admin/admin-filter-pills";
import {
  MISSING_RECORDING_REASONS,
  missingRecordingReasonLabel,
  type MissingRecordingCounts,
  type MissingRecordingKind,
  type MissingRecordingReason,
  type MissingRecordingRow,
} from "@/lib/admin/missing-recordings/types";
import { uploadToStorageAsAdmin } from "@/lib/supabase/admin-upload";
import { LESSON_LOG_MEDIA_BUCKET } from "@/lib/storage/signed-media";
import { ui } from "@/lib/ui/styles";

const MAX_RECORDING_UPLOAD_BYTES = 524_288_000;

const emptyCounts: MissingRecordingCounts = { total: 0, one_to_one: 0, group: 0 };

function formatLessonDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function overdueLabel(dueAt: string): string {
  const elapsed = Date.now() - new Date(dueAt).getTime();
  const days = Math.max(1, Math.floor(elapsed / 86_400_000));
  return `Overdue ${days} day${days === 1 ? "" : "s"}`;
}

function rowLabel(row: MissingRecordingRow): string {
  if (row.kind === "one_to_one") return row.student_name?.trim() || row.target_name?.trim() || "1-1 lesson";
  return row.target_name?.trim() || "Group lesson";
}

function adjustCounts(
  counts: MissingRecordingCounts,
  kind: MissingRecordingKind,
  delta: number
): MissingRecordingCounts {
  return {
    total: Math.max(0, counts.total + delta),
    one_to_one: Math.max(0, counts.one_to_one + (kind === "one_to_one" ? delta : 0)),
    group: Math.max(0, counts.group + (kind === "group" ? delta : 0)),
  };
}

export function AdminMissingRecordingsSection() {
  const [rows, setRows] = useState<MissingRecordingRow[]>([]);
  const [counts, setCounts] = useState<MissingRecordingCounts>(emptyCounts);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<MissingRecordingKind | "all">("all");
  const [showDismissed, setShowDismissed] = useState(false);
  const [search, setSearch] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [dismissing, setDismissing] = useState<MissingRecordingRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMissingRecordings().then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setCounts(result.counts);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const modeRows = useMemo(
    () => rows.filter((row) => (showDismissed ? row.recording_dismissed_at : !row.recording_dismissed_at)),
    [rows, showDismissed]
  );

  const kindCounts = useMemo(() => {
    let oneToOne = 0;
    let group = 0;
    for (const row of modeRows) {
      if (row.kind === "one_to_one") oneToOne += 1;
      else group += 1;
    }
    return { all: modeRows.length, one_to_one: oneToOne, group };
  }, [modeRows]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return modeRows.filter((row) => {
      if (kind !== "all" && row.kind !== kind) return false;
      if (!query) return true;
      const haystack = [
        rowLabel(row),
        row.target_name,
        row.student_name,
        row.tutor_name,
        row.lesson_title,
        row.lesson_date,
        row.kind === "group" ? "group" : "1-1",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [modeRows, kind, search]);

  function clearRowError(entryId: string) {
    setRowErrors((current) => {
      if (!current[entryId]) return current;
      const next = { ...current };
      delete next[entryId];
      return next;
    });
  }

  function removeOpenRow(row: MissingRecordingRow) {
    setRows((current) => current.filter((entry) => entry.entry_id !== row.entry_id));
    setCounts((current) => adjustCounts(current, row.kind, -1));
  }

  async function saveLink(row: MissingRecordingRow) {
    const url = (links[row.entry_id] ?? "").trim();
    if (!url) {
      setRowErrors((current) => ({ ...current, [row.entry_id]: "Paste a recording link first." }));
      return;
    }
    setPendingId(row.entry_id);
    clearRowError(row.entry_id);
    const result = await saveMissingRecordingLink(row.entry_id, url);
    setPendingId(null);
    if (result.error) {
      setRowErrors((current) => ({ ...current, [row.entry_id]: result.error ?? "Could not save the link." }));
      return;
    }
    removeOpenRow(row);
  }

  async function uploadFile(row: MissingRecordingRow, file: File) {
    if (file.size > MAX_RECORDING_UPLOAD_BYTES) {
      setRowErrors((current) => ({
        ...current,
        [row.entry_id]: `File too large (${Math.round(file.size / 1_000_000)}MB). Max is ${Math.round(MAX_RECORDING_UPLOAD_BYTES / 1_000_000)}MB for recordings.`,
      }));
      return;
    }
    setPendingId(row.entry_id);
    clearRowError(row.entry_id);
    try {
      const url = await uploadToStorageAsAdmin(LESSON_LOG_MEDIA_BUCKET, file);
      const result = await saveMissingRecordingUpload(row.entry_id, url);
      if (result.error) {
        setRowErrors((current) => ({ ...current, [row.entry_id]: result.error ?? "Upload failed." }));
        return;
      }
      removeOpenRow(row);
    } catch (uploadError) {
      setRowErrors((current) => ({
        ...current,
        [row.entry_id]: uploadError instanceof Error ? uploadError.message : "Upload failed.",
      }));
    } finally {
      setPendingId(null);
    }
  }

  async function undismiss(row: MissingRecordingRow) {
    setPendingId(row.entry_id);
    clearRowError(row.entry_id);
    const result = await undismissMissingRecording(row.entry_id);
    setPendingId(null);
    if (result.error) {
      setRowErrors((current) => ({ ...current, [row.entry_id]: result.error ?? "Could not undismiss." }));
      return;
    }
    setRows((current) =>
      current.map((entry) =>
        entry.entry_id === row.entry_id
          ? {
              ...entry,
              recording_dismissed_at: null,
              recording_dismissed_by: null,
              recording_dismissed_by_name: null,
              recording_dismiss_reason: null,
              recording_dismiss_note: null,
            }
          : entry
      )
    );
    setCounts((current) => adjustCounts(current, row.kind, 1));
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link href="/admin" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Admin home
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">Missing recordings</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Lessons completed more than 24 hours ago with no recording.
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          1-1 ({counts.one_to_one}), group ({counts.group})
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AdminFilterPill
          label={`All ${kindCounts.all}`}
          active={kind === "all"}
          onClick={() => setKind("all")}
        />
        <AdminFilterPill
          label={`1-1 ${kindCounts.one_to_one}`}
          active={kind === "one_to_one"}
          onClick={() => setKind("one_to_one")}
        />
        <AdminFilterPill
          label={`Group ${kindCounts.group}`}
          active={kind === "group"}
          onClick={() => setKind("group")}
        />
        <label className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(event) => setShowDismissed(event.target.checked)}
          />
          Show dismissed
        </label>
      </div>

      <label className="mb-6 block max-w-md text-sm text-zinc-600">
        Search
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cohort, student, tutor, or lesson"
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </label>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : visible.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">Nothing in this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => {
            const pending = pendingId === row.entry_id;
            return (
              <article
                key={row.entry_id}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">
                        {row.kind === "group" ? "Group" : "1-1"}
                      </span>
                      <span className="text-xs font-semibold text-amber-700">{overdueLabel(row.due_at)}</span>
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-zinc-900">{rowLabel(row)}</h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      {row.tutor_name?.trim() || "No tutor"} · {formatLessonDate(row.lesson_date)}
                      {row.lesson_title?.trim() ? ` · ${row.lesson_title.trim()}` : ""}
                    </p>
                  </div>
                </div>

                {showDismissed && row.recording_dismissed_at ? (
                  <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">
                      {missingRecordingReasonLabel(row.recording_dismiss_reason)}
                    </p>
                    {row.recording_dismiss_note ? (
                      <p className="mt-1">{row.recording_dismiss_note}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500">
                      {row.recording_dismissed_by_name?.trim() || "Admin"} ·{" "}
                      {formatWhen(row.recording_dismissed_at)}
                    </p>
                    <button
                      type="button"
                      disabled={pending}
                      className="mt-3 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 disabled:opacity-60"
                      onClick={() => void undismiss(row)}
                    >
                      {pending ? "Undismissing…" : "Undismiss"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <input
                      value={links[row.entry_id] ?? ""}
                      onChange={(event) =>
                        setLinks((current) => ({ ...current, [row.entry_id]: event.target.value }))
                      }
                      placeholder="https:// recording link"
                      className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      onClick={() => void saveLink(row)}
                    >
                      {pending ? "Saving…" : "Save"}
                    </button>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700">
                      {pending ? "Uploading…" : "Upload"}
                      <input
                        type="file"
                        accept="video/*,audio/*"
                        className="sr-only"
                        disabled={pending}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void uploadFile(row, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                      onClick={() => {
                        clearRowError(row.entry_id);
                        setDismissing(row);
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {rowErrors[row.entry_id] ? (
                  <p className="mt-2 text-sm text-red-600">{rowErrors[row.entry_id]}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {dismissing ? (
        <DismissDialog
          row={dismissing}
          pending={pendingId === dismissing.entry_id}
          onClose={() => setDismissing(null)}
          onSubmit={async (reason, note) => {
            setPendingId(dismissing.entry_id);
            const result = await dismissMissingRecording(dismissing.entry_id, reason, note);
            setPendingId(null);
            if (result.error) {
              setRowErrors((current) => ({
                ...current,
                [dismissing.entry_id]: result.error ?? "Could not dismiss.",
              }));
              return;
            }
            const saved = dismissing;
            setRows((current) =>
              current.map((entry) =>
                entry.entry_id === saved.entry_id
                  ? {
                      ...entry,
                      recording_dismissed_at: new Date().toISOString(),
                      recording_dismiss_reason: reason,
                      recording_dismiss_note: note.trim() || null,
                      recording_dismissed_by_name: entry.recording_dismissed_by_name ?? "You",
                    }
                  : entry
              )
            );
            setCounts((current) => adjustCounts(current, saved.kind, -1));
            setDismissing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function DismissDialog({
  row,
  pending,
  onClose,
  onSubmit,
}: {
  row: MissingRecordingRow;
  pending: boolean;
  onClose: () => void;
  onSubmit: (reason: MissingRecordingReason, note: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<MissingRecordingReason>("software_failed");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 p-4 sm:items-center">
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (reason === "other" && !note.trim()) {
            setLocalError("A note is required when the reason is other.");
            return;
          }
          setLocalError(null);
          void onSubmit(reason, note);
        }}
      >
        <h2 className="text-lg font-semibold text-zinc-900">Dismiss recording</h2>
        <p className="mt-1 text-sm text-zinc-500">{rowLabel(row)}</p>
        <label className="mt-4 block text-sm text-zinc-700">
          Reason
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as MissingRecordingReason)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            {MISSING_RECORDING_REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm text-zinc-700">
          Note {reason === "other" ? "(required)" : "(optional)"}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        {localError ? <p className="mt-2 text-sm text-red-600">{localError}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Dismissing…" : "Dismiss"}
          </button>
        </div>
      </form>
    </div>
  );
}
