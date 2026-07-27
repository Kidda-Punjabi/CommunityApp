"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createAdminLessonLogEntry } from "@/app/admin/lesson-log/actions";
import { updateCohortAutoUnlockOnLog } from "@/app/admin/packages/actions";
import type { AdminPackageKind, PackageSessionLogEntry } from "@/lib/admin/packages/types";

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

type PackageSessionLogSectionProps = {
  kind: AdminPackageKind;
  runId: string;
  entries: PackageSessionLogEntry[];
  /** Cohort-only: when true (default), logging unlocks linked curriculum. */
  autoUnlockOnLog?: boolean;
  onLogged: () => void;
};

export function PackageSessionLogSection({
  kind,
  runId,
  entries,
  autoUnlockOnLog,
  onLogged,
}: PackageSessionLogSectionProps) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [lessonDate, setLessonDate] = useState(todayDateInput());
  const [recordingUrl, setRecordingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const logKind = kind === "cohort" ? "cohort" : "package_instance";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Lessons log
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Session log for this package (date-ordered, like Notion Lessons Log). Cancelled entries
            are hidden from default progress counts.
            {kind === "cohort"
              ? " With auto-unlock on, logging a session releases that lesson in Learn."
              : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {kind === "cohort" && autoUnlockOnLog !== undefined ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={autoUnlockOnLog}
                disabled={pending}
                onChange={(e) => {
                  startTransition(async () => {
                    setError(null);
                    setMessage(null);
                    const result = await updateCohortAutoUnlockOnLog(runId, e.target.checked);
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    setMessage(result.success ?? "Updated auto-unlock setting.");
                    onLogged();
                  });
                }}
                className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="font-medium">Auto-unlock on log</span>
            </label>
          ) : null}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/lesson-log"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Open full lesson log
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
          >
            {showForm ? "Hide form" : "Log lesson"}
          </button>
        </div>
        </div>
      </div>

      {message ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}

      {showForm ? (
        <div className="mt-4 space-y-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
          <input
            type="date"
            value={lessonDate}
            onChange={(e) => setLessonDate(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
          <input
            value={recordingUrl}
            onChange={(e) => setRecordingUrl(e.target.value)}
            placeholder="Recording URL (optional)"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !lessonDate}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => {
              startTransition(async () => {
                setError(null);
                setMessage(null);
                const result = await createAdminLessonLogEntry({
                  kind: logKind,
                  runId,
                  lessonDate,
                  recordingUrl,
                  notes,
                  status: "Completed",
                });
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setMessage(result.success ?? "Lesson logged.");
                setShowForm(false);
                setRecordingUrl("");
                setNotes("");
                onLogged();
              });
            }}
          >
            Create in app + Notion
          </button>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No sessions logged yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900">
                  {formatDate(entry.lessonDate)}
                  {entry.status ? ` · ${entry.status}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {entry.curriculumLessonLabel ?? entry.lessonTitle ?? "Untitled session"}
                </p>
                {entry.isUnlocked ? (
                  <p className="mt-0.5 text-[11px] font-medium text-emerald-700">Unlocked for students</p>
                ) : entry.curriculumLessonLabel ? (
                  <p className="mt-0.5 text-[11px] text-zinc-500">Not unlocked in Learn yet</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {entry.recordingUrl ? (
                  <a
                    href={entry.recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-violet-700 hover:text-violet-500"
                  >
                    Recording
                  </a>
                ) : null}
                <Link
                  href="/admin/lesson-log"
                  className="font-medium text-violet-700 hover:text-violet-500"
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
