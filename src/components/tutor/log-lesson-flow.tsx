"use client";

import {
  retryTutorLessonSyncAction,
  saveTutorLessonAction,
} from "@/app/dashboard/tutor/log/actions";
import type { LogLessonSweepResult } from "@/lib/tutoring/log-lesson-sweep";
import type {
  LogCohortOption,
  LogLessonCatalog,
  LogLessonChoice,
  LogPinnedNote,
  LogRosterPerson,
  LogStudentOption,
} from "@/lib/tutoring/load-log-lesson-catalog";
import { isHttpUrl, lessonSlotLabel } from "@/lib/tutoring/log-lesson-copy";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useMemo, useState } from "react";

type Kind = "group" | "one_to_one";

type LogLessonFlowProps = {
  catalog: LogLessonCatalog;
  today: string;
  initialCohortId: string | null;
  initialPackageId: string | null;
};

function suggestedLesson(lessons: LogLessonChoice[]): LogLessonChoice | null {
  return lessons.find((lesson) => !lesson.logged) ?? null;
}

export function LogLessonFlow({
  catalog,
  today,
  initialCohortId,
  initialPackageId,
}: LogLessonFlowProps) {
  const initialCohort = catalog.cohorts.find((cohort) => cohort.id === initialCohortId) ?? null;
  const initialStudent =
    catalog.students.find((student) => student.packageInstanceId === initialPackageId) ?? null;

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(
    initialCohort || initialStudent ? 3 : 1
  );
  const [kind, setKind] = useState<Kind | null>(
    initialCohort ? "group" : initialStudent ? "one_to_one" : null
  );
  const [cohortId, setCohortId] = useState<string | null>(initialCohort?.id ?? null);
  const [packageId, setPackageId] = useState<string | null>(
    initialStudent?.packageInstanceId ?? null
  );
  const [lessonId, setLessonId] = useState<string | null>(
    initialCohort
      ? suggestedLesson(initialCohort.lessons)?.lessonId ?? null
      : initialStudent
        ? suggestedLesson(initialStudent.lessons)?.lessonId ?? null
        : null
  );
  const [lessonDate, setLessonDate] = useState(today);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [attended, setAttended] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<LogLessonSweepResult | null>(null);

  const cohort = catalog.cohorts.find((row) => row.id === cohortId) ?? null;
  const student = catalog.students.find((row) => row.packageInstanceId === packageId) ?? null;
  const lessons = kind === "group" ? cohort?.lessons ?? [] : student?.lessons ?? [];
  const selected = lessons.find((lesson) => lesson.lessonId === lessonId) ?? null;
  const courseName = kind === "group" ? cohort?.courseName ?? "" : student?.courseName ?? "";

  const presentCount = useMemo(() => {
    if (!cohort) return 0;
    return cohort.students.filter((person) => present[person.id] !== false).length;
  }, [cohort, present]);

  function chooseKind(next: Kind) {
    setKind(next);
    setError(null);
    setStep(2);
  }

  function chooseCohort(next: LogCohortOption) {
    setCohortId(next.id);
    setLessonId(suggestedLesson(next.lessons)?.lessonId ?? null);
    setPresent(Object.fromEntries(next.students.map((person) => [person.id, true])));
    setError(null);
    setStep(3);
  }

  function chooseStudent(next: LogStudentOption) {
    setPackageId(next.packageInstanceId);
    setLessonId(suggestedLesson(next.lessons)?.lessonId ?? null);
    setAttended(true);
    setError(null);
    setStep(3);
  }

  function validateDetails(): string | null {
    if (!selected || selected.logged) return "Choose a lesson that has not been logged yet.";
    if (!lessonDate) return "Choose the date you taught.";
    if (recordingUrl.trim() && !isHttpUrl(recordingUrl)) {
      return "Enter a full recording link starting with http:// or https://";
    }
    return null;
  }

  async function save(
    attendance: Array<{
      id: string;
      kind: "student" | "kid";
      name: string;
      attended: boolean;
    }>
  ) {
    const problem = validateDetails();
    if (problem || !kind || !selected) {
      setError(problem ?? "Choose a lesson.");
      return;
    }
    setSaving(true);
    setError(null);
    const saved = await saveTutorLessonAction({
      kind,
      cohortId: kind === "group" ? cohortId ?? undefined : undefined,
      packageInstanceId: kind === "one_to_one" ? packageId ?? undefined : undefined,
      lessonId: selected.lessonId,
      lessonDate,
      recordingUrl,
      notes,
      attendance,
    });
    setSaving(false);
    if (!saved.ok) {
      setError(saved.error ?? "The lesson could not be saved.");
      return;
    }
    setResult(saved);
    setStep(5);
  }

  async function retry() {
    if (!result?.entryId) return;
    setSaving(true);
    const saved = await retryTutorLessonSyncAction(result.entryId);
    setSaving(false);
    if (!saved.ok) {
      setError(saved.error ?? "Retry failed.");
      return;
    }
    setResult({ ...saved, headline: result.headline || saved.headline });
    setError(null);
  }

  return (
    <div className={`${ui.page} mx-auto w-full max-w-[390px]`}>
      {step < 5 ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Log a lesson
        </p>
      ) : null}

      {step === 1 ? (
        <section>
          <h1 className="mt-2 font-heading text-2xl font-bold text-zinc-900">What did you teach?</h1>
          <div className="mt-6 space-y-3">
            <ChoiceCard
              title={`Group class (${catalog.cohorts.length} active cohort${catalog.cohorts.length === 1 ? "" : "s"})`}
              onClick={() => chooseKind("group")}
            />
            <ChoiceCard
              title={`1-1 lesson (${catalog.students.length} active student${catalog.students.length === 1 ? "" : "s"})`}
              onClick={() => chooseKind("one_to_one")}
            />
          </div>
        </section>
      ) : null}

      {step === 2 && kind === "group" ? (
        <section>
          <BackButton onClick={() => setStep(1)} />
          <h1 className="mt-3 font-heading text-2xl font-bold text-zinc-900">Which cohort?</h1>
          <div className="mt-5 space-y-3">
            {catalog.cohorts.length === 0 ? (
              <p className="text-sm text-zinc-500">No active group cohorts.</p>
            ) : (
              catalog.cohorts.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => chooseCohort(row)}
                  className="min-h-11 w-full rounded-3xl border border-zinc-200 bg-white p-4 text-left shadow-sm"
                >
                  <p className="text-base font-semibold text-zinc-900">{row.name}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {row.schedule} · {row.studentCount} student{row.studentCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-2 text-sm font-medium text-violet-700">
                    {row.nextLessonNumber
                      ? `Next: ${lessonSlotLabel(row.courseName, row.nextLessonNumber)} · ${row.nextLessonTitle}`
                      : "All lessons logged"}
                  </p>
                  <Progress
                    logged={row.loggedCount}
                    total={row.totalLessons}
                    label={`${row.loggedCount} of ${row.totalLessons} ${row.foundational ? "lessons" : "weeks"} logged`}
                  />
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}

      {step === 2 && kind === "one_to_one" ? (
        <section>
          <BackButton onClick={() => setStep(1)} />
          <h1 className="mt-3 font-heading text-2xl font-bold text-zinc-900">Which student?</h1>
          <div className="mt-5 space-y-3">
            {catalog.students.length === 0 ? (
              <p className="text-sm text-zinc-500">No active 1-1 students.</p>
            ) : (
              catalog.students.map((row) => (
                <button
                  key={row.packageInstanceId}
                  type="button"
                  onClick={() => chooseStudent(row)}
                  className="min-h-11 w-full rounded-3xl border border-zinc-200 bg-white p-4 text-left shadow-sm"
                >
                  <p className="text-base font-semibold text-zinc-900">{row.studentName}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {row.courseName}
                    {row.schedule !== "Schedule not set" ? ` · ${row.schedule}` : ""}
                  </p>
                  <p className="mt-2 text-sm font-medium text-violet-700">
                    {row.nextLessonNumber
                      ? `Next: ${lessonSlotLabel(row.courseName, row.nextLessonNumber)}`
                      : "All lessons logged"}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}

      {step === 3 && (cohort || student) ? (
        <section>
          <BackButton onClick={() => setStep(2)} />
          <h1 className="mt-3 font-heading text-2xl font-bold text-zinc-900">
            {kind === "group" ? "Which week did you teach?" : "Which lesson did you teach?"}
          </h1>
          <PinnedNote
            note={(kind === "group" ? cohort?.pinnedNote : student?.pinnedNote) ?? null}
            foundational={Boolean(kind === "group" ? cohort?.foundational : student?.foundational)}
          />
          {selected ? (
            <div className="mt-4 rounded-3xl bg-violet-600 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-100">
                Suggested
              </p>
              <p className="mt-1 text-lg font-bold">
                {lessonSlotLabel(courseName, selected.lessonNumber)} · {selected.title}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">Every lesson for this class is already logged.</p>
          )}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {lessons.map((lesson) => {
              const active = lesson.lessonId === lessonId;
              return (
                <button
                  key={lesson.lessonId}
                  type="button"
                  disabled={lesson.logged}
                  onClick={() => setLessonId(lesson.lessonId)}
                  className={`min-h-11 rounded-2xl text-sm font-semibold ${
                    lesson.logged
                      ? "bg-zinc-100 text-zinc-400"
                      : active
                        ? "bg-violet-600 text-white"
                        : "bg-white text-zinc-800 ring-1 ring-zinc-200"
                  }`}
                >
                  {lesson.lessonNumber}
                </button>
              );
            })}
          </div>
          <label className="mt-5 block text-sm font-semibold text-zinc-800">
            Date taught
            <input
              type="date"
              value={lessonDate}
              onChange={(event) => setLessonDate(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-2xl border border-zinc-200 px-3 text-base"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-zinc-800">
            Recording link
            <input
              type="url"
              inputMode="url"
              placeholder="https://"
              value={recordingUrl}
              onChange={(event) => setRecordingUrl(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-2xl border border-zinc-200 px-3 text-base"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-zinc-800">
            Carry over to next lesson
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-3 text-base"
            />
          </label>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          {kind === "group" ? (
            <button
              type="button"
              className={`${ui.btnPrimaryBlock} mt-5 min-h-11`}
              onClick={() => {
                const problem = validateDetails();
                if (problem) {
                  setError(problem);
                  return;
                }
                if (cohort) {
                  setPresent(Object.fromEntries(cohort.students.map((person) => [person.id, true])));
                }
                setError(null);
                setStep(4);
              }}
            >
              Next: attendance
            </button>
          ) : student ? (
            <div className="mt-5">
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-200">
                <span className="text-sm font-semibold text-zinc-900">{student.studentName} attended</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={attended}
                  onClick={() => setAttended((value) => !value)}
                  className={`relative h-8 w-14 shrink-0 rounded-full ${attended ? "bg-violet-600" : "bg-zinc-300"}`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${attended ? "left-7" : "left-1"}`}
                  />
                </button>
              </div>
              <button
                type="button"
                disabled={saving || !selected}
                onClick={() =>
                  void save([
                    {
                      id: student.kidProfileId ?? student.studentId ?? "",
                      kind: student.kidProfileId ? "kid" : "student",
                      name: student.studentName,
                      attended,
                    },
                  ])
                }
                className={`${ui.btnPrimaryBlock} mt-4 min-h-11 disabled:opacity-60`}
              >
                {saving ? "Saving..." : "Save and send to Notion"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 4 && cohort ? (
        <section>
          <BackButton onClick={() => setStep(3)} />
          <h1 className="mt-3 font-heading text-2xl font-bold text-zinc-900">Who was there?</h1>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-violet-700">
              {presentCount} of {cohort.students.length} present
            </p>
            <button
              type="button"
              className="min-h-11 rounded-full bg-violet-50 px-4 text-sm font-semibold text-violet-700"
              onClick={() =>
                setPresent(Object.fromEntries(cohort.students.map((person) => [person.id, true])))
              }
            >
              Mark all present
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {cohort.students.map((person) => (
              <AttendanceRow
                key={person.id}
                person={person}
                present={present[person.id] !== false}
                onChange={(value) => setPresent((current) => ({ ...current, [person.id]: value }))}
              />
            ))}
          </ul>
          {cohort.students.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No active students on this cohort.</p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          <button
            type="button"
            disabled={saving || cohort.students.length === 0}
            onClick={() =>
              void save(
                cohort.students.map((person) => ({
                  id: person.id,
                  kind: person.kind,
                  name: person.name,
                  attended: present[person.id] !== false,
                }))
              )
            }
            className={`${ui.btnPrimaryBlock} mt-5 min-h-11 disabled:opacity-60`}
          >
            {saving ? "Saving..." : "Save and send to Notion"}
          </button>
        </section>
      ) : null}

      {step === 5 && result ? (
        <DoneScreen
          result={result}
          saving={saving}
          onRetry={() => void retry()}
          onAnother={() => {
            setStep(1);
            setKind(null);
            setCohortId(null);
            setPackageId(null);
            setLessonId(null);
            setLessonDate(today);
            setRecordingUrl("");
            setNotes("");
            setPresent({});
            setAttended(true);
            setResult(null);
            setError(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ChoiceCard({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[72px] w-full rounded-3xl bg-violet-600 px-5 py-4 text-left text-lg font-semibold text-white shadow-[0_8px_24px_-10px_rgba(124,58,237,0.7)]"
    >
      {title}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 text-sm font-semibold text-violet-700">
      Back
    </button>
  );
}

function Progress({ logged, total, label }: { logged: number; total: number; label: string }) {
  const width = total > 0 ? Math.round((logged / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-violet-100">
        <div className="h-full rounded-full bg-violet-600" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function PinnedNote({ note, foundational }: { note: LogPinnedNote | null; foundational: boolean }) {
  if (!note) return null;
  const slot = foundational ? `LESSON ${note.lessonNumber}` : `WEEK ${note.lessonNumber}`;
  return (
    <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="text-xs font-semibold uppercase tracking-wider">You noted after {slot}</p>
      <p className="mt-1 whitespace-pre-wrap">{note.notes}</p>
    </div>
  );
}

function AttendanceRow({
  person,
  present,
  onChange,
}: {
  person: LogRosterPerson;
  present: boolean;
  onChange: (present: boolean) => void;
}) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-zinc-200">
      <span className="text-sm font-medium text-zinc-900">{person.name}</span>
      <span className="flex rounded-full bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`min-h-11 rounded-full px-3 text-sm font-semibold ${present ? "bg-violet-600 text-white" : "text-zinc-500"}`}
        >
          Present
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`min-h-11 rounded-full px-3 text-sm font-semibold ${!present ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
        >
          Absent
        </button>
      </span>
    </li>
  );
}

function DoneScreen({
  result,
  saving,
  onRetry,
  onAnother,
}: {
  result: LogLessonSweepResult;
  saving: boolean;
  onRetry: () => void;
  onAnother: () => void;
}) {
  const readback = result.readback;
  const confirmed = result.confirmed && readback;
  return (
    <section>
      <h1 className="font-heading text-2xl font-bold text-zinc-900">Done</h1>
      <p className="mt-2 text-base font-medium text-zinc-800">{result.headline}</p>
      <div
        className={`mt-4 rounded-3xl p-4 ${confirmed ? "bg-emerald-50 text-emerald-950" : "bg-red-50 text-red-950"}`}
      >
        <p className="text-sm font-semibold">
          {confirmed
            ? `Confirmed in Notion · read back ${result.readAt}`
            : `Notion needs a check · read back ${result.readAt}`}
        </p>
        {result.notionError ? <p className="mt-2 text-sm">{result.notionError}</p> : null}
        {result.differences.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {result.differences.map((diff) => (
              <li key={diff.field}>
                <span className="font-semibold">{diff.field}:</span> saved "{diff.submitted}", Notion has "
                {diff.actual}"
              </li>
            ))}
          </ul>
        ) : null}
        {readback ? (
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Title" value={readback.title} />
            <Row label="Date" value={readback.date} />
            <Row label="Lesson" value={readback.lesson} />
            <Row label="Recording" value={readback.recordingUrl || "None"} />
            <div>
              <dt className="font-semibold">Attendees</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {readback.attendeeNames.length === 0 ? (
                  <span>None</span>
                ) : (
                  readback.attendeeNames.map((name) => (
                    <span key={name} className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold">
                      {name}
                    </span>
                  ))
                )}
              </dd>
            </div>
            <Row label="Absent" value={readback.absentNames.join(", ") || "None"} />
            <Row label="Tutor" value={readback.tutorName || "Not set"} />
          </dl>
        ) : null}
        {readback?.notionUrl ? (
          <a
            href={readback.notionUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline"
          >
            Open in Notion
          </a>
        ) : null}
        {!confirmed && result.entryId ? (
          <button
            type="button"
            disabled={saving}
            onClick={onRetry}
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full bg-red-700 px-4 text-sm font-semibold text-white"
          >
            {saving ? "Retrying..." : "Retry sync"}
          </button>
        ) : null}
      </div>
      <div className="mt-5 space-y-3">
        <Link href="/dashboard/tutor" className={`${ui.btnPrimaryBlock} min-h-11`}>
          Done
        </Link>
        <button type="button" onClick={onAnother} className={`${ui.btnSecondary} min-h-11 w-full`}>
          Log another lesson
        </button>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
