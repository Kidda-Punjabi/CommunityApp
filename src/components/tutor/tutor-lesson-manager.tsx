"use client";

import {
  removeCohortLessonRecording,
  removeStudentLessonRecording,
  saveCohortLessonRecording,
  saveStudentLessonRecording,
  setCohortLessonUnlock,
  setStudentLessonUnlock,
} from "@/app/dashboard/tutor/actions";
import type { TutorLessonRow } from "@/lib/tutoring/load-tutor-dashboard";
import { ui } from "@/lib/ui/styles";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TutorActionResult } from "@/app/dashboard/tutor/actions";

type StudentScope = {
  mode: "student";
  studentId: string;
  courseId: string;
};

type CohortScope = {
  mode: "cohort";
  cohortId: string;
};

type TutorLessonManagerProps = {
  lessons: TutorLessonRow[];
  scope: StudentScope | CohortScope;
  scopeLabel: string;
};

export function TutorLessonManager({ lessons, scope, scopeLabel }: TutorLessonManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<TutorActionResult>({});
  const [recordingDrafts, setRecordingDrafts] = useState<Record<string, string>>({});

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleToggle(lesson: TutorLessonRow) {
    setMessage({});
    const result =
      scope.mode === "student"
        ? await setStudentLessonUnlock(
            scope.studentId,
            scope.courseId,
            lesson.id,
            !lesson.unlocked
          )
        : await setCohortLessonUnlock(scope.cohortId, lesson.id, !lesson.unlocked);
    setMessage(result);
    if (!result.error) refresh();
  }

  async function handleSaveRecording(lessonId: string) {
    setMessage({});
    const url = recordingDrafts[lessonId] ?? "";
    const result =
      scope.mode === "student"
        ? await saveStudentLessonRecording(scope.studentId, scope.courseId, lessonId, url)
        : await saveCohortLessonRecording(scope.cohortId, lessonId, url);
    setMessage(result);
    if (!result.error) {
      setRecordingDrafts((current) => {
        const next = { ...current };
        delete next[lessonId];
        return next;
      });
      refresh();
    }
  }

  async function handleRemoveRecording(lessonId: string) {
    setMessage({});
    const result =
      scope.mode === "student"
        ? await removeStudentLessonRecording(scope.studentId, lessonId)
        : await removeCohortLessonRecording(scope.cohortId, lessonId);
    setMessage(result);
    if (!result.error) refresh();
  }

  if (lessons.length === 0) {
    return <p className="text-sm text-zinc-500">No lessons in this course yet.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Tick lessons to unlock them for {scopeLabel}. Untick when you want to hide content
        again. Add a recording link for catch-up sessions.
      </p>

      {message.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{message.error}</p>
      )}
      {message.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {message.success}
        </p>
      )}

      <ul className="space-y-3">
        {lessons.map((lesson) => (
          <li key={lesson.id} className={ui.cardBordered}>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={lesson.unlocked}
                disabled={pending}
                onChange={() => handleToggle(lesson)}
                className="mt-1 h-5 w-5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                aria-label={`Unlock lesson ${lesson.lessonNumber}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                  Lesson {lesson.lessonNumber}
                </p>
                <p className="font-semibold text-zinc-900">{lesson.title}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {lesson.unlocked ? "Unlocked" : "Locked"}
                </p>
              </div>
            </div>

            {lesson.unlocked && (
              <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Recording link
                </label>
                {lesson.recordingUrl ? (
                  <div className="space-y-2">
                    <a
                      href={lesson.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-medium text-violet-600 hover:text-violet-500"
                    >
                      {lesson.recordingUrl}
                    </a>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleRemoveRecording(lesson.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      Remove link
                    </button>
                  </div>
                ) : null}
                <input
                  type="url"
                  value={recordingDrafts[lesson.id] ?? lesson.recordingUrl ?? ""}
                  onChange={(event) =>
                    setRecordingDrafts((current) => ({
                      ...current,
                      [lesson.id]: event.target.value,
                    }))
                  }
                  placeholder="https://youtube.com/... or Zoom / Loom link"
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleSaveRecording(lesson.id)}
                  className={ui.btnSecondary}
                >
                  Save recording link
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
