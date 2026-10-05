import Link from "next/link";
import { UnlockEarlyButton } from "@/components/tutor/class-lesson-actions";
import { LessonLogEdit } from "@/components/tutor/lesson-log-edit";
import type { CoverTutorChoice } from "@/lib/tutoring/cover-lesson";
import { lessonSlotLabel } from "@/lib/tutoring/log-lesson-copy";
import type { ClassDetail } from "@/lib/tutoring/load-tutor-classes";

export function ClassDetailView({
  detail,
  cohortId,
  packageInstanceId,
  tutors,
}: {
  detail: ClassDetail;
  cohortId?: string;
  packageInstanceId?: string;
  tutors: CoverTutorChoice[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-col gap-4 px-4 py-5">
      <Link href="/dashboard/tutor/classes" className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700">
        Back to Classes
      </Link>
      <div>
        <h1 className="font-heading text-2xl font-bold text-zinc-900">{detail.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {detail.courseName}
          {detail.schedule ? ` · ${detail.schedule}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-zinc-900">
            {detail.loggedCount}/{detail.totalLessons}
          </p>
          <p className="text-[11px] text-zinc-500">Weeks logged</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-zinc-900">
            {detail.attendancePercent == null ? "0%" : `${detail.attendancePercent}%`}
          </p>
          <p className="text-[11px] text-zinc-500">Attendance</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className={`text-lg font-bold ${detail.recordingsMissing > 0 ? "text-red-600" : "text-zinc-900"}`}>
            {detail.recordingsMissing}
          </p>
          <p className="text-[11px] text-zinc-500">Recordings missing</p>
        </div>
      </div>

      {detail.pinned ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
            Carry over · from {lessonSlotLabel(detail.courseName, detail.pinned.lessonNumber)}
          </p>
          <p className="mt-2 text-sm text-zinc-800">{detail.pinned.notes}</p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {detail.lessons.map((lesson) => {
          const slot = lessonSlotLabel(detail.courseName, lesson.lessonNumber);
          if (lesson.state === "logged" && !lesson.hasRecording) {
            return (
              <li key={lesson.lessonId} className="rounded-2xl border border-red-200 bg-red-50 p-3">
                <p className="font-semibold text-red-700">
                  {slot} · {lesson.title}
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {lesson.dateLabel ?? "Logged"} · {lesson.present}/{lesson.total} · recording missing
                </p>
                {lesson.coverLabel ? (
                  <p className="mt-1 text-sm font-medium text-violet-700">{lesson.coverLabel}</p>
                ) : null}
                {detail.kind === "one_to_one" && lesson.notes ? (
                  <p className="mt-1 text-sm text-zinc-700">{lesson.notes}</p>
                ) : null}
                {detail.kind === "one_to_one" && lesson.homeworkLabel ? (
                  <p className="mt-1 text-sm text-zinc-600">Homework: {lesson.homeworkLabel}</p>
                ) : null}
                {lesson.entryId ? (
                  <LessonLogEdit
                    entryId={lesson.entryId}
                    recordingUrl={lesson.recordingUrl}
                    isCoverSession={lesson.isCoverSession}
                    actualTutorId={lesson.actualTutorId}
                    attendance={lesson.attendance}
                    tutors={tutors}
                  />
                ) : null}
              </li>
            );
          }
          if (lesson.state === "logged") {
            return (
              <li key={lesson.lessonId} className="rounded-2xl bg-white p-3 shadow-sm">
                <p className="font-semibold text-emerald-700">
                  <span aria-hidden="true">✓ </span>
                  {slot} · {lesson.title}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {lesson.dateLabel ?? "Logged"} · {lesson.present}/{lesson.total} · recorded
                </p>
                {lesson.coverLabel ? (
                  <p className="mt-1 text-sm font-medium text-violet-700">{lesson.coverLabel}</p>
                ) : null}
                {detail.kind === "one_to_one" && lesson.notes ? (
                  <p className="mt-1 text-sm text-zinc-700">{lesson.notes}</p>
                ) : null}
                {detail.kind === "one_to_one" && lesson.homeworkLabel ? (
                  <p className="mt-1 text-sm text-zinc-600">Homework: {lesson.homeworkLabel}</p>
                ) : null}
                {lesson.entryId ? (
                  <LessonLogEdit
                    entryId={lesson.entryId}
                    recordingUrl={lesson.recordingUrl}
                    isCoverSession={lesson.isCoverSession}
                    actualTutorId={lesson.actualTutorId}
                    attendance={lesson.attendance}
                    tutors={tutors}
                  />
                ) : null}
              </li>
            );
          }
          if (lesson.state === "next") {
            return (
              <li key={lesson.lessonId} className="rounded-2xl border border-violet-300 bg-violet-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Next to teach</p>
                <p className="mt-1 font-semibold text-zinc-900">
                  {slot} · {lesson.title}
                </p>
                <Link
                  href={detail.logHref}
                  className="mt-3 inline-flex min-h-11 items-center rounded-full bg-violet-600 px-4 text-sm font-semibold text-white"
                >
                  Log
                </Link>
              </li>
            );
          }
          return (
            <li key={lesson.lessonId} className="rounded-2xl bg-white p-3 text-zinc-500 shadow-sm">
              <p className="flex items-center gap-2 font-medium">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                </svg>
                {slot} · {lesson.title}
              </p>
              {lesson.unlockEarly ? (
                <UnlockEarlyButton
                  cohortId={cohortId}
                  packageInstanceId={packageInstanceId}
                  courseId={detail.courseId}
                  lessonId={lesson.lessonId}
                  studentId={detail.unlockStudentId}
                  kidProfileId={detail.unlockKidProfileId}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {detail.students.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-zinc-700">Students</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {detail.students.map((student) => (
              <span key={student.id} className="rounded-full bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm">
                {student.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
