"use client";

import { useEffect, useState, useTransition } from "react";
import {
  fetchAdminLessonLogRoster,
  saveAdminLessonLogAttendanceHomework,
} from "@/app/admin/lesson-log/actions";
import type { LessonLogRosterContext } from "@/lib/lessons/lesson-log-roster";

type MarkState = {
  attended: boolean;
  homeworkCompleted: boolean;
};

type LessonLogAttendanceHomeworkPanelProps = {
  entryId: string;
  isCohort: boolean;
  onMessage: (message: string | null) => void;
  onError: (error: string | null) => void;
};

export function LessonLogAttendanceHomeworkPanel({
  entryId,
  isCohort,
  onMessage,
  onError,
}: LessonLogAttendanceHomeworkPanelProps) {
  const [pending, startTransition] = useTransition();
  const [context, setContext] = useState<LessonLogRosterContext | null>(null);
  const [marks, setMarks] = useState<Record<string, MarkState>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCohort) {
      setContext(null);
      setMarks({});
      setLoadError(null);
      return;
    }

    let cancelled = false;
    startTransition(async () => {
      const result = await fetchAdminLessonLogRoster(entryId);
      if (cancelled) return;
      if (result.error || !result.context) {
        setLoadError(result.error ?? "Failed to load roster.");
        setContext(null);
        setMarks({});
        return;
      }
      setLoadError(null);
      setContext(result.context);
      const next: Record<string, MarkState> = {};
      for (const student of result.context.students) {
        next[student.studentId] = {
          attended: student.attended ?? false,
          homeworkCompleted: student.homeworkCompleted ?? false,
        };
      }
      setMarks(next);
    });

    return () => {
      cancelled = true;
    };
  }, [entryId, isCohort]);

  if (!isCohort) {
    return (
      <p className="text-[11px] text-zinc-500">
        Attendance / homework marking is for group cohorts only.
      </p>
    );
  }

  if (loadError) {
    return <p className="text-[11px] font-medium text-amber-800">{loadError}</p>;
  }

  if (!context) {
    return <p className="text-[11px] text-zinc-500">Loading roster…</p>;
  }

  const unlinked = context.students.filter((s) => !s.notionLeadLinked);

  return (
    <div className="space-y-2 border-t border-zinc-200 pt-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Attendance & homework
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-600">
          Saves to the app and pushes Notion <code className="text-[10px]">Attendees</code> /{" "}
          <code className="text-[10px]">Homework</code> relations (payroll reads these).{" "}
          {context.curriculumLessonTitle
            ? `Mapped curriculum lesson: ${context.curriculumLessonTitle}.`
            : "No curriculum lesson mapped yet (needs a non-cancelled log in sequence)."}
        </p>
      </div>

      {unlinked.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
          <p className="font-semibold">Notion Lead not linked (missing App User ID)</p>
          <p className="mt-0.5">
            These students will save in the app but will not appear on the Notion Attendees /
            Homework relations until their Lead page has App User ID set:{" "}
            {unlinked.map((s) => s.studentName).join(", ")}.
          </p>
        </div>
      ) : null}

      {context.students.length === 0 ? (
        <p className="text-[11px] text-zinc-500">No cohort members on this package yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {context.students.map((student) => {
            const mark = marks[student.studentId] ?? {
              attended: false,
              homeworkCompleted: false,
            };
            return (
              <li
                key={student.studentId}
                className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-900">{student.studentName}</p>
                  <p className="text-[10px] text-zinc-500">
                    {student.notionLeadLinked
                      ? "Notion Lead linked"
                      : "No Notion App User ID match"}
                    {!student.isActiveMember ? " · left cohort" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-zinc-700">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={mark.attended}
                      disabled={pending || !context.curriculumLessonId}
                      onChange={(e) =>
                        setMarks((prev) => ({
                          ...prev,
                          [student.studentId]: {
                            ...mark,
                            attended: e.target.checked,
                          },
                        }))
                      }
                    />
                    Present
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={mark.homeworkCompleted}
                      disabled={pending || !context.curriculumLessonId}
                      onChange={(e) =>
                        setMarks((prev) => ({
                          ...prev,
                          [student.studentId]: {
                            ...mark,
                            homeworkCompleted: e.target.checked,
                          },
                        }))
                      }
                    />
                    Homework
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={
          pending ||
          !context.curriculumLessonId ||
          context.students.length === 0
        }
        className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 disabled:opacity-60"
        onClick={() => {
          startTransition(async () => {
            onError(null);
            onMessage(null);
            const payload = context.students.map((student) => {
              const mark = marks[student.studentId] ?? {
                attended: false,
                homeworkCompleted: false,
              };
              return {
                studentId: student.studentId,
                attended: mark.attended,
                homeworkCompleted: mark.homeworkCompleted,
              };
            });
            const result = await saveAdminLessonLogAttendanceHomework(entryId, payload);
            if (result.error) {
              onError(result.error);
              return;
            }
            onMessage(result.success ?? "Saved attendance/homework.");
            const refreshed = await fetchAdminLessonLogRoster(entryId);
            if (refreshed.context) {
              setContext(refreshed.context);
            }
          });
        }}
      >
        {pending ? "Saving…" : "Save attendance & homework → Notion"}
      </button>
    </div>
  );
}
