"use client";

import { useEffect, useState, useTransition } from "react";
import {
  loadAttendanceLessons,
  loadAttendanceRoster,
  saveCohortLessonAttendance,
  type AttendanceMarkInput,
} from "@/app/dashboard/tutor/attendance-actions";
import type { TutorCohortRow } from "@/lib/tutoring/load-tutor-dashboard";
import type { CohortAttendanceRosterStudent } from "@/lib/tutoring/cohort-attendance";
import { ui } from "@/lib/ui/styles";

type TutorAttendanceSectionProps = {
  cohorts: TutorCohortRow[];
  fullPage?: boolean;
};

type AttendanceChoice = boolean | null;

function formatMarkedAt(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function TutorAttendanceSection({
  cohorts,
  fullPage = false,
}: TutorAttendanceSectionProps) {
  const [cohortId, setCohortId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [lessons, setLessons] = useState<
    Awaited<ReturnType<typeof loadAttendanceLessons>>["lessons"]
  >([]);
  const [markedLessonIds, setMarkedLessonIds] = useState<string[]>([]);
  const [roster, setRoster] = useState<CohortAttendanceRosterStudent[]>([]);
  const [choices, setChoices] = useState<Record<string, AttendanceChoice>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedCohort = cohorts.find((cohort) => cohort.cohortId === cohortId) ?? null;

  useEffect(() => {
    if (!selectedCohort) {
      setLessons([]);
      setMarkedLessonIds([]);
      setLessonId("");
      return;
    }

    let cancelled = false;
    startTransition(async () => {
      const result = await loadAttendanceLessons(
        selectedCohort.cohortId,
        selectedCohort.courseId
      );
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setLessons([]);
        setMarkedLessonIds([]);
        return;
      }
      setError(null);
      setLessons(result.lessons);
      setMarkedLessonIds(result.markedLessonIds);
      setLessonId("");
      setRoster([]);
      setChoices({});
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCohort]);

  useEffect(() => {
    if (!cohortId || !lessonId) {
      setRoster([]);
      setChoices({});
      return;
    }

    let cancelled = false;
    startTransition(async () => {
      const result = await loadAttendanceRoster(cohortId, lessonId);
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setRoster([]);
        setChoices({});
        return;
      }
      setError(null);
      setRoster(result.roster);
      const initial: Record<string, AttendanceChoice> = {};
      for (const student of result.roster) {
        initial[student.studentId] = student.attended;
      }
      setChoices(initial);
    });

    return () => {
      cancelled = true;
    };
  }, [cohortId, lessonId]);

  function setChoice(studentId: string, attended: boolean) {
    setChoices((current) => ({ ...current, [studentId]: attended }));
    setSuccess(null);
    setWarning(null);
  }

  function handleSave() {
    if (!cohortId || !lessonId || roster.length === 0) return;

    const marks: AttendanceMarkInput[] = [];
    for (const student of roster) {
      const choice = choices[student.studentId];
      if (choice === null || choice === undefined) {
        setError(`Mark attendance for ${student.studentName} before saving.`);
        setSuccess(null);
        return;
      }
      marks.push({ studentId: student.studentId, attended: choice });
    }

    setError(null);
    setWarning(null);
    startTransition(async () => {
      const result = await saveCohortLessonAttendance(cohortId, lessonId, marks);
      if (result.error) {
        setError(result.error);
        setSuccess(null);
        setWarning(null);
        return;
      }
      setSuccess(result.success ?? "Attendance saved.");
      setWarning(result.warning ?? null);
      setMarkedLessonIds((current) =>
        current.includes(lessonId) ? current : [...current, lessonId]
      );
      const refreshed = await loadAttendanceRoster(cohortId, lessonId);
      if (!refreshed.error) {
        setRoster(refreshed.roster);
      }
    });
  }

  if (cohorts.length === 0) {
    return null;
  }

  const lessonMarkedBefore = lessonId ? markedLessonIds.includes(lessonId) : false;
  const showSaveBar = Boolean(lessonId && roster.length > 0);

  const content = (
    <div className={`${ui.cardBordered} space-y-4 ${showSaveBar && fullPage ? "pb-2" : ""}`}>
        <div className={fullPage ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">Group cohort</span>
            <select
              value={cohortId}
              onChange={(event) => setCohortId(event.target.value)}
              className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">Select cohort…</option>
              {cohorts.map((cohort) => (
                <option key={cohort.cohortId} value={cohort.cohortId}>
                  {cohort.cohortName} ({cohort.courseName})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-500">Lesson</span>
            <select
              value={lessonId}
              onChange={(event) => setLessonId(event.target.value)}
              disabled={!cohortId || lessons.length === 0}
              className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:bg-zinc-50 disabled:text-zinc-400"
            >
              <option value="">Select lesson…</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  Lesson {lesson.lessonNumber}: {lesson.title}
                  {markedLessonIds.includes(lesson.id) ? " ✓" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {lessonId && (
          <p className="text-sm text-zinc-600">
            {lessonMarkedBefore
              ? "Previously saved — you can update attendance below."
              : "First time marking attendance for this lesson."}
          </p>
        )}

        {lessonId && roster.length > 0 && (
          <ul className="space-y-3 border-t border-zinc-100 pt-4">
            {roster.map((student) => {
              const choice = choices[student.studentId] ?? null;
              const markedLabel = formatMarkedAt(student.markedAt);

              return (
                <li
                  key={student.studentId}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900">{student.studentName}</p>
                      {!student.isActiveMember && (
                        <p className="text-xs text-violet-600">Left cohort — historical</p>
                      )}
                      {markedLabel && (
                        <p className="text-xs text-zinc-500">Last saved {markedLabel}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setChoice(student.studentId, true)}
                      className={`rounded-2xl py-3.5 text-sm font-semibold transition-colors ${
                        choice === true
                          ? "bg-green-600 text-white shadow-sm"
                          : "border border-zinc-200 bg-zinc-50 text-zinc-700 active:bg-green-50"
                      }`}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      onClick={() => setChoice(student.studentId, false)}
                      className={`rounded-2xl py-3.5 text-sm font-semibold transition-colors ${
                        choice === false
                          ? "bg-zinc-700 text-white shadow-sm"
                          : "border border-zinc-200 bg-zinc-50 text-zinc-700 active:bg-zinc-100"
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {lessonId && roster.length === 0 && !pending && (
          <p className="text-sm text-zinc-500">No students in this cohort yet.</p>
        )}

        {lessonId && roster.length > 0 && !fullPage && (
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className={ui.btnPrimary}
          >
            {pending ? "Saving…" : "Save attendance"}
          </button>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}
        {warning && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">⚠️ {warning}</p>
          </div>
        )}
      </div>
  );

  if (!fullPage) {
    return (
      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Mark attendance</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Record who attended each group live session. This is separate from unlocking
          lessons for the cohort.
        </p>
        {content}
      </section>
    );
  }

  return (
    <>
      {content}
      {showSaveBar && (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-40 border-t border-violet-200/70 bg-violet-50/95 px-5 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
            {success && <p className="text-center text-sm text-green-700">{success}</p>}
            {warning && (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
                <p className="text-center text-sm font-medium text-amber-900">⚠️ {warning}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className={ui.btnPrimaryBlock}
            >
              {pending ? "Saving…" : "Save attendance"}
            </button>
          </div>
        </div>
      )}
      {showSaveBar && <div className="h-24" aria-hidden="true" />}
    </>
  );
}
