"use client";

import { logCohortLessonAction } from "@/app/dashboard/tutor/log-lesson-actions";
import { ui } from "@/lib/ui/styles";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

export type LogLessonCohortOption = {
  cohortId: string;
  cohortName: string;
  courseName: string;
};

type TutorLogLessonFormProps = {
  cohorts: LogLessonCohortOption[];
  defaultCohortId?: string | null;
};

function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function TutorLogLessonForm({ cohorts, defaultCohortId }: TutorLogLessonFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const submittingRef = useRef(false);

  if (cohorts.length === 0) {
    return (
      <div className={ui.emptyState}>
        <p className="text-lg font-semibold text-zinc-900">No group cohorts</p>
        <p className="mt-2 text-sm text-zinc-500">
          Lesson logging is for group cohorts linked to Notion. Ask admin if a cohort is missing.
        </p>
      </div>
    );
  }

  function handleSubmit(formData: FormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await logCohortLessonAction(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(result.success ?? "Lesson logged.");
        router.refresh();
      } finally {
        submittingRef.current = false;
      }
    });
  }

  return (
    <form action={handleSubmit} className={`${ui.cardBordered} space-y-4`}>
      <div>
        <label htmlFor="cohort_id" className="text-sm font-medium text-zinc-700">
          Cohort
        </label>
        <select
          id="cohort_id"
          name="cohort_id"
          required
          defaultValue={defaultCohortId ?? cohorts[0]?.cohortId}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
        >
          {cohorts.map((cohort) => (
            <option key={cohort.cohortId} value={cohort.cohortId}>
              {cohort.cohortName} · {cohort.courseName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="lesson_date" className="text-sm font-medium text-zinc-700">
          Lesson date
        </label>
        <input
          id="lesson_date"
          name="lesson_date"
          type="date"
          required
          defaultValue={todayInputValue()}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="recording_url" className="text-sm font-medium text-zinc-700">
          Recording link <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <input
          id="recording_url"
          name="recording_url"
          type="url"
          placeholder="https://…"
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="notes" className="text-sm font-medium text-zinc-700">
          Notes <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Anything to remember about this session"
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
        />
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      <button type="submit" disabled={pending} className={ui.btnPrimary}>
        {pending ? "Logging…" : "Log this lesson"}
      </button>
    </form>
  );
}
