"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLoggedLessonAction, type ClassActionResult } from "@/app/dashboard/tutor/classes/actions";
import type { CoverTutorChoice } from "@/lib/tutoring/cover-lesson";
import type { LessonLogEditAttendance } from "@/lib/tutoring/lesson-log-edit";
import { isFoundationalCourse, lessonListLabel } from "@/lib/tutoring/log-lesson-copy";

type LessonChoice = {
  id: string;
  lessonNumber: number;
  title: string;
  taken: boolean;
};

export function LessonLogEdit({
  entryId,
  lessonId,
  lessonDate,
  notes,
  courseName,
  lessons,
  recordingUrl,
  isCoverSession,
  actualTutorId,
  attendance,
  homework,
  tutors,
}: {
  entryId: string;
  lessonId: string;
  lessonDate: string;
  notes: string;
  courseName: string;
  lessons: LessonChoice[];
  recordingUrl: string;
  isCoverSession: boolean;
  actualTutorId: string | null;
  attendance: LessonLogEditAttendance[];
  homework: Array<{ id: string; name: string; submitted: boolean }>;
  tutors: CoverTutorChoice[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState(lessonId);
  const [date, setDate] = useState(lessonDate);
  const [note, setNote] = useState(notes);
  const [url, setUrl] = useState(recordingUrl);
  const [cover, setCover] = useState(isCoverSession);
  const [teacherId, setTeacherId] = useState(actualTutorId ?? "");
  const [present, setPresent] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(attendance.map((person) => [person.id, person.attended]))
  );
  const [submitted, setSubmitted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(homework.map((person) => [person.id, person.submitted]))
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function resetForm() {
    setSelectedLessonId(lessonId);
    setDate(lessonDate);
    setNote(notes);
    setUrl(recordingUrl);
    setCover(isCoverSession);
    setTeacherId(actualTutorId ?? "");
    setPresent(Object.fromEntries(attendance.map((person) => [person.id, person.attended])));
    setSubmitted(Object.fromEntries(homework.map((person) => [person.id, person.submitted])));
    setError(null);
    setResult(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        className="mt-3 inline-flex min-h-11 items-center rounded-full border border-violet-200 bg-white px-4 text-sm font-semibold text-violet-700"
      >
        Edit
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setResult(null);
        const teacher = tutors.find((row) => row.id === teacherId);
        if (cover && !teacherId) {
          setError("Choose who taught this lesson.");
          return;
        }
        if (cover && teacher && !teacher.notionLinked) {
          setError(`${teacher.name} is not linked to a Notion tutor profile, so this cover lesson cannot be saved.`);
          return;
        }
        startTransition(async () => {
          const saved = await updateLoggedLessonAction({
            entryId,
            lessonId: selectedLessonId,
            lessonDate: date,
            notes: note,
            recordingUrl: url,
            isCoverSession: cover,
            actualTutorId: cover ? teacherId : null,
            attendance: attendance.map((person) => ({
              ...person,
              attended: present[person.id] !== false,
            })),
            homeworkSubmittedIds: homework.filter((person) => submitted[person.id]).map((person) => person.id),
          });
          if (saved.error && !saved.differences) {
            setError(saved.error);
            return;
          }
          setResult(saved);
          setError(saved.error ?? null);
          router.refresh();
        });
      }}
    >
      <label className="text-sm font-semibold text-zinc-900">
        {isFoundationalCourse(courseName) ? "Lesson" : "Week"}
        <select
          value={selectedLessonId}
          onChange={(event) => setSelectedLessonId(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-base text-zinc-900"
        >
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id} disabled={lesson.taken}>
              {lessonListLabel(courseName, lesson.lessonNumber, lesson.title)}
              {lesson.taken ? " (already logged)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-semibold text-zinc-900">
        Date taught
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-base text-zinc-900"
        />
      </label>

      <label className="text-sm font-semibold text-zinc-900">
        Recording link
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://"
          className="mt-1 min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
        />
      </label>

      <label className="text-sm font-semibold text-zinc-900">
        Carry over to next lesson
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-base text-zinc-900"
        />
      </label>

      <div>
        <p className="text-sm font-semibold text-zinc-900">Who was there?</p>
        <ul className="mt-2 flex flex-col gap-2">
          {attendance.map((person) => {
            const attended = present[person.id] !== false;
            return (
              <li
                key={person.id}
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-3 py-2"
              >
                <span className="text-sm font-medium text-zinc-900">{person.name}</span>
                <span className="flex rounded-full bg-white p-1 ring-1 ring-zinc-200">
                  <button
                    type="button"
                    onClick={() => setPresent((current) => ({ ...current, [person.id]: true }))}
                    className={`min-h-11 rounded-full px-3 text-sm font-semibold ${attended ? "bg-violet-600 text-white" : "text-zinc-500"}`}
                  >
                    Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresent((current) => ({ ...current, [person.id]: false }))}
                    className={`min-h-11 rounded-full px-3 text-sm font-semibold ${!attended ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
                  >
                    Absent
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-900">Homework for this lesson</p>
        <ul className="mt-2 flex flex-col gap-2">
          {homework.map((person) => {
            const done = Boolean(submitted[person.id]);
            return (
              <li
                key={person.id}
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-3 py-2"
              >
                <span className="text-sm font-medium text-zinc-900">{person.name}</span>
                <span className="flex rounded-full bg-white p-1 ring-1 ring-zinc-200">
                  <button
                    type="button"
                    onClick={() => setSubmitted((current) => ({ ...current, [person.id]: true }))}
                    className={`min-h-11 rounded-full px-3 text-sm font-semibold ${done ? "bg-violet-600 text-white" : "text-zinc-500"}`}
                  >
                    Submitted
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmitted((current) => ({ ...current, [person.id]: false }))}
                    className={`min-h-11 rounded-full px-3 text-sm font-semibold ${!done ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
                  >
                    Not yet
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm text-zinc-500">
          This is the homework for the lesson already taught. Update writes it on the same Notion lesson log.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-900">Was this a cover lesson?</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCover(false)}
            className={`min-h-11 rounded-full border text-sm font-semibold ${
              cover ? "border-zinc-200 text-zinc-700" : "border-violet-600 bg-violet-600 text-white"
            }`}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => setCover(true)}
            className={`min-h-11 rounded-full border text-sm font-semibold ${
              cover ? "border-violet-600 bg-violet-600 text-white" : "border-zinc-200 text-zinc-700"
            }`}
          >
            Yes
          </button>
        </div>
        {cover ? (
          <div className="mt-3">
            <label htmlFor={`cover-${entryId}`} className="text-sm font-semibold text-zinc-900">
              Who taught this lesson?
            </label>
            <select
              id={`cover-${entryId}`}
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-base text-zinc-900"
            >
              <option value="">Choose a tutor</option>
              {tutors.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.name}
                  {tutor.notionLinked ? "" : " (no Notion link)"}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-zinc-500">Pay for this lesson goes to the tutor who taught it.</p>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {result && !result.error ? (
        <div className={`rounded-3xl p-4 text-sm ${result.confirmed ? "bg-emerald-50 text-emerald-950" : "bg-red-50 text-red-950"}`}>
          <p className="font-semibold">
            {result.confirmed
              ? `Confirmed in Notion · read back ${result.readAt ?? ""}`
              : `Notion needs a check · read back ${result.readAt ?? ""}`}
          </p>
          {result.differences?.some((diff) => diff.submitted === "Tutor missing in Notion") ? (
            <p className="mt-2 font-semibold">Tutor missing in Notion</p>
          ) : null}
          {result.differences && result.differences.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {result.differences
                .filter((diff) => diff.submitted !== "Tutor missing in Notion")
                .map((diff) => (
                  <li key={diff.field}>
                    <span className="font-semibold">{diff.field}:</span> saved "{diff.submitted}", Notion has "{diff.actual}"
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 flex-1 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Updating" : "Update"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
