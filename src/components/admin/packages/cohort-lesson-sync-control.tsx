"use client";

import { useState, useTransition } from "react";
import {
  confirmCohortIndividualLessonSyncAction,
  loadCohortIndividualLessonSyncAction,
} from "@/app/admin/packages/actions";
import type { CohortLessonSyncPreview } from "@/lib/admin/packages/cohort-lesson-sync";

type CohortLessonSyncControlProps = {
  cohortId: string;
  state: "synced" | "needs_assignment" | "none";
  onSynced: () => void;
};

export function CohortLessonSyncControl({
  cohortId,
  state,
  onSynced,
}: CohortLessonSyncControlProps) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<CohortLessonSyncPreview | null>(null);
  const [lessonIdBySession, setLessonIdBySession] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    startTransition(async () => {
      const result = await loadCohortIndividualLessonSyncAction(cohortId);
      if (result.error || !result.preview) {
        setError(result.error ?? "Could not load lessons.");
        setPreview(null);
        return;
      }
      const selected: Record<string, string> = {};
      for (const row of result.preview.rows) {
        selected[row.sessionId] = row.lessonId ?? "";
      }
      setLessonIdBySession(selected);
      setPreview(result.preview);
    });
  }

  function confirm() {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmCohortIndividualLessonSyncAction({
        cohortId,
        mappings: preview.rows.map((row) => ({
          sessionId: row.sessionId,
          lessonId: lessonIdBySession[row.sessionId] || null,
        })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setPreview(null);
      onSynced();
    });
  }

  return (
    <div className="space-y-1.5">
      {state === "synced" ? (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          Individual lessons synced
        </span>
      ) : null}
      {state === "needs_assignment" ? (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
          Needs lesson assignment
        </span>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={open}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending && !preview ? "Loading…" : "Sync individual lessons"}
      </button>
      {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
      {preview ? (
        <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          {preview.rows.length === 0 ? (
            <p className="text-[10px] text-zinc-500">No Kidda Class sessions on this cohort yet.</p>
          ) : (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {preview.rows.map((row) => (
                <li key={row.sessionId} className="rounded-md bg-white p-2">
                  <label className="block text-[10px] font-medium text-zinc-500" htmlFor={row.sessionId}>
                    {row.whenLabel}
                  </label>
                  <select
                    id={row.sessionId}
                    value={lessonIdBySession[row.sessionId] ?? ""}
                    onChange={(event) =>
                      setLessonIdBySession((current) => ({
                        ...current,
                        [row.sessionId]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-[11px] text-zinc-900"
                  >
                    <option value="">Needs assignment</option>
                    {preview.lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.lessonNumber}. {lesson.title}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={pending || preview.rows.length === 0}
              onClick={confirm}
              className="rounded-md bg-violet-700 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Confirm lesson sync"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setPreview(null)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
