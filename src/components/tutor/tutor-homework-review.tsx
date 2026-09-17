"use client";

import { useEffect, useState, useTransition } from "react";
import { loadAttendanceLessons } from "@/app/dashboard/tutor/attendance-actions";
import {
  getHomeworkPlaybackUrl,
  loadHomeworkCohortRoster,
  reviewHomeworkSubmission,
} from "@/app/dashboard/tutor/homework-actions";
import type {
  HomeworkCohortRosterStudent,
  PendingHomeworkReviewRow,
} from "@/lib/tutoring/homework-submissions";
import type { TutorCohortRow } from "@/lib/tutoring/load-tutor-dashboard";
import { cn, ui } from "@/lib/ui/styles";

type HomeworkReviewTab = "all" | "cohort";

type TutorHomeworkReviewProps = {
  submissions: PendingHomeworkReviewRow[];
  cohorts?: TutorCohortRow[];
  fullPage?: boolean;
};

function formatSubmittedAt(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function TimingBadge({
  state,
}: {
  state: PendingHomeworkReviewRow["timingState"];
}) {
  if (state === "on_time" || state === "unknown") return null;
  if (state === "late") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
        Late (&lt;24h)
      </span>
    );
  }
  return (
    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-900">
      After lesson
    </span>
  );
}

function ReviewAudioPlayer({ storagePath }: { storagePath: string }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getHomeworkPlaybackUrl(storagePath).then((result) => {
      if (cancelled) return;
      if (result.playbackUrl) {
        setAudioUrl(result.playbackUrl);
      } else {
        setError(result.error ?? "Could not load audio.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!audioUrl) return <p className="text-sm text-zinc-500">Loading audio…</p>;

  return <audio controls src={audioUrl} className="w-full" preload="metadata" />;
}

function HomeworkReviewCard({
  submission,
  onReviewed,
}: {
  submission: PendingHomeworkReviewRow;
  onReviewed: (submissionId: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitReview(approved: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await reviewHomeworkSubmission(
        submission.id,
        approved,
        comment.trim() || null
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onReviewed(submission.id);
    });
  }

  return (
    <li className={ui.cardBordered}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-900">{submission.studentName}</p>
          <p className="mt-1 text-sm text-zinc-600">
            Lesson {submission.lessonNumber}: {submission.lessonTitle}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Submitted {formatSubmittedAt(submission.submittedAt)}
          </p>
        </div>
        <TimingBadge state={submission.timingState} />
      </div>

      <div className="mt-4">
        {submission.submissionType === "text" ? (
          <div className="space-y-3">
            {submission.textAnswers?.map((answer) => {
              const key = submission.answerKeys.find(
                (row) => row.questionNumber === answer.question_number
              );
              return (
                <div key={answer.question_number} className="rounded-xl border border-zinc-200 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-900">
                    {answer.question_number}. {key?.promptEnglish ?? "Question"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-700">
                    Student: {answer.answer_text || "—"}
                  </p>
                  {key ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Answer key: {key.answerGurmukhi ? `${key.answerGurmukhi} / ` : ""}
                      {key.answerRomanised}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : submission.storagePath ? (
          <ReviewAudioPlayer storagePath={submission.storagePath} />
        ) : (
          <p className="text-sm text-zinc-500">No recording attached.</p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">Comment (optional on approve)</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="Share encouragement or tips for your student…"
            className="mt-1.5 block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={() => submitReview(true)}
            className={ui.btnPrimary}
          >
            {pending ? "Saving…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => submitReview(false)}
            className={ui.btnSecondary}
          >
            Needs improvement
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </li>
  );
}

function HomeworkRosterStatusCard({
  student,
}: {
  student: HomeworkCohortRosterStudent;
}) {
  const label =
    student.reviewedStatus === "approved"
      ? "Approved"
      : student.reviewedStatus === "needs_improvement"
        ? "Needs improvement"
        : "Not submitted";
  const badgeClass =
    student.reviewedStatus === "approved"
      ? "bg-green-100 text-green-800"
      : student.reviewedStatus === "needs_improvement"
        ? "bg-amber-100 text-amber-900"
        : "bg-zinc-100 text-zinc-600";

  return (
    <li className={ui.cardBordered}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-900">{student.studentName}</p>
          {!student.isActiveMember && (
            <p className="mt-1 text-xs text-violet-600">Left cohort — historical</p>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
          {label}
        </span>
      </div>
    </li>
  );
}

export function TutorHomeworkReview({
  submissions,
  cohorts = [],
  fullPage = false,
}: TutorHomeworkReviewProps) {
  const [tab, setTab] = useState<HomeworkReviewTab>("all");
  const [rows, setRows] = useState(submissions);
  const [cohortId, setCohortId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [lessons, setLessons] = useState<
    Awaited<ReturnType<typeof loadAttendanceLessons>>["lessons"]
  >([]);
  const [roster, setRoster] = useState<HomeworkCohortRosterStudent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedCohort = cohorts.find((cohort) => cohort.cohortId === cohortId) ?? null;

  useEffect(() => {
    setRows(submissions);
  }, [submissions]);

  useEffect(() => {
    if (!selectedCohort) {
      setLessons([]);
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
        return;
      }
      setError(null);
      setLessons(result.lessons);
      setLessonId("");
      setRoster([]);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCohort]);

  useEffect(() => {
    if (!cohortId || !lessonId) {
      setRoster([]);
      return;
    }

    let cancelled = false;
    startTransition(async () => {
      const result = await loadHomeworkCohortRoster(cohortId, lessonId);
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setRoster([]);
        return;
      }
      setError(null);
      setRoster(result.roster);
    });

    return () => {
      cancelled = true;
    };
  }, [cohortId, lessonId]);

  function handleReviewed(submissionId: string) {
    setRows((current) => current.filter((row) => row.id !== submissionId));
    if (!cohortId || !lessonId) return;
    startTransition(async () => {
      const result = await loadHomeworkCohortRoster(cohortId, lessonId);
      if (result.error) return;
      setRoster(result.roster);
    });
  }

  const list = (
    <>
      {rows.length === 0 ? (
        <div className={fullPage ? ui.emptyState : undefined}>
          {fullPage ? (
            <>
              <span className="text-5xl" role="img" aria-hidden="true">
                🎧
              </span>
              <p className="mt-4 text-lg font-semibold text-zinc-900">All caught up</p>
              <p className="mt-2 text-sm text-zinc-500">
                No homework waiting for review right now.
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">No homework waiting for review.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((submission) => (
            <HomeworkReviewCard
              key={submission.id}
              submission={submission}
              onReviewed={handleReviewed}
            />
          ))}
        </ul>
      )}
    </>
  );

  const cohortPanel = (
    <div className="space-y-4">
      {cohorts.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Homework roster is for group classes. No group cohorts are assigned yet.
        </p>
      ) : (
        <>
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
                  </option>
                ))}
              </select>
            </label>
          </div>

          {lessonId && roster.length > 0 && (
            <ul className="space-y-4">
              {roster.map((student) =>
                student.pendingSubmission ? (
                  <HomeworkReviewCard
                    key={student.studentId}
                    submission={student.pendingSubmission}
                    onReviewed={handleReviewed}
                  />
                ) : (
                  <HomeworkRosterStatusCard key={student.studentId} student={student} />
                )
              )}
            </ul>
          )}

          {lessonId && roster.length === 0 && !pending && (
            <p className="text-sm text-zinc-500">No students in this cohort yet.</p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );

  const body = (
    <>
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Homework review views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          onClick={() => setTab("all")}
          className={cn(tab === "all" ? ui.pillActive : ui.pillInactive)}
        >
          All submissions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "cohort"}
          onClick={() => setTab("cohort")}
          className={cn(tab === "cohort" ? ui.pillActive : ui.pillInactive)}
        >
          By cohort
        </button>
      </div>
      {tab === "all" ? list : cohortPanel}
    </>
  );

  if (fullPage) {
    return body;
  }

  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Homework review</h2>
      {body}
    </section>
  );
}
