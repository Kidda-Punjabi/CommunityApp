"use client";

import { logCohortLessonAction } from "@/app/dashboard/tutor/log-lesson-actions";
import { ui } from "@/lib/ui/styles";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

export type LogLessonCohortOption = {
  cohortId: string;
  cohortName: string;
  courseName: string;
};

export type LogLessonExistingEntry = {
  cohortId: string;
  lessonDate: string;
  status: string | null;
};

type TutorLogLessonFormProps = {
  cohorts: LogLessonCohortOption[];
  existingLogs: LogLessonExistingEntry[];
  defaultCohortId?: string | null;
};

function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatLogDate(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${isoDate}T12:00:00`));
}

export function TutorLogLessonForm({
  cohorts,
  existingLogs,
  defaultCohortId,
}: TutorLogLessonFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cohortId, setCohortId] = useState(defaultCohortId ?? cohorts[0]?.cohortId ?? "");
  const [lessonDate, setLessonDate] = useState(todayInputValue());
  const submittingRef = useRef(false);

  const logsForCohort = useMemo(
    () =>
      existingLogs
        .filter((entry) => entry.cohortId === cohortId)
        .slice()
        .sort((a, b) => b.lessonDate.localeCompare(a.lessonDate)),
    [existingLogs, cohortId]
  );

  const alreadyLogged = logsForCohort.find((entry) => entry.lessonDate === lessonDate) ?? null;
  const recentLogs = logsForCohort.slice(0, 5);

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
      <p className="text-sm text-zinc-500">
        Logging here writes the Lessons Log in Notion. If this date is already logged (in the app
        or in Notion), we update that entry instead of creating a second page.
      </p>
      <div>
        <label htmlFor="cohort_id" className="text-sm font-medium text-zinc-700">
          Cohort
        </label>
        <select
          id="cohort_id"
          name="cohort_id"
          required
          value={cohortId}
          onChange={(event) => setCohortId(event.target.value)}
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
          value={lessonDate}
          onChange={(event) => setLessonDate(event.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
        />
      </div>

      {alreadyLogged ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Already logged for this session
          {alreadyLogged.status ? ` (${alreadyLogged.status})` : ""} ✓ — submitting will update
          the existing entry rather than create a duplicate in Notion.
        </p>
      ) : null}

      {recentLogs.length > 0 ? (
        <p className="text-xs text-zinc-500">
          Recent logs for this cohort:{" "}
          {recentLogs
            .map(
              (entry) =>
                `${formatLogDate(entry.lessonDate)}${
                  entry.status ? ` · ${entry.status}` : ""
                }`
            )
            .join("; ")}
        </p>
      ) : null}

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
        {pending
          ? "Saving…"
          : alreadyLogged
            ? "Update existing log"
            : "Log this lesson"}
      </button>
    </form>
  );
}
