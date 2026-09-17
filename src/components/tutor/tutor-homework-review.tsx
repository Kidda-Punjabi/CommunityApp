"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getHomeworkPlaybackUrl,
  reviewHomeworkSubmission,
} from "@/app/dashboard/tutor/homework-actions";
import {
  homeworkReviewedKey,
  pendingBadgeLabel,
  type HomeworkBoardPendingRow,
  type HomeworkReviewPackage,
} from "@/lib/tutoring/homework-review-packages";
import type { PendingHomeworkReviewRow } from "@/lib/tutoring/homework-submissions";
import { cn, ui } from "@/lib/ui/styles";

type HomeworkReviewTab = "pending" | "packages";
type RosterPill = "awaiting" | "reviewed" | "not_submitted";

type TutorHomeworkReviewProps = {
  submissions: HomeworkBoardPendingRow[];
  packages?: HomeworkReviewPackage[];
  reviewedKeys?: string[];
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

function PendingCountBadge({
  count,
  active,
}: {
  count: number;
  active?: boolean;
}) {
  const label = pendingBadgeLabel(count);
  const upToDate = count <= 0;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        upToDate
          ? active
            ? "bg-white/20 text-white"
            : "bg-zinc-100 text-zinc-600"
          : active
            ? "bg-white text-violet-700"
            : "bg-amber-100 text-amber-900"
      )}
    >
      {label}
    </span>
  );
}

function rosterPill(status: RosterPill): { label: string; className: string } {
  if (status === "awaiting") {
    return { label: "Awaiting review", className: "bg-amber-100 text-amber-900" };
  }
  if (status === "reviewed") {
    return { label: "Reviewed", className: "bg-green-100 text-green-800" };
  }
  return { label: "Not submitted", className: "bg-zinc-100 text-zinc-600" };
}

function studentRosterStatus(
  studentId: string,
  lessonId: string,
  packageId: string,
  pendingRows: HomeworkBoardPendingRow[],
  reviewed: Set<string>
): { status: RosterPill; submission: HomeworkBoardPendingRow | null } {
  const submission =
    pendingRows.find(
      (row) =>
        row.packageId === packageId &&
        row.lessonId === lessonId &&
        row.studentId === studentId
    ) ?? null;
  if (submission) return { status: "awaiting", submission };
  if (reviewed.has(homeworkReviewedKey(studentId, lessonId))) {
    return { status: "reviewed", submission: null };
  }
  return { status: "not_submitted", submission: null };
}

export function TutorHomeworkReview({
  submissions,
  packages = [],
  reviewedKeys = [],
  fullPage = false,
}: TutorHomeworkReviewProps) {
  const [tab, setTab] = useState<HomeworkReviewTab>("packages");
  const [rows, setRows] = useState(submissions);
  const [reviewed, setReviewed] = useState(() => new Set(reviewedKeys));
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  const [openLessonKey, setOpenLessonKey] = useState<string | null>(null);
  const [expandedStudentKey, setExpandedStudentKey] = useState<string | null>(null);

  useEffect(() => {
    setRows(submissions);
  }, [submissions]);

  useEffect(() => {
    setReviewed(new Set(reviewedKeys));
  }, [reviewedKeys]);

  const counts = useMemo(() => {
    const byPackage: Record<string, number> = {};
    const byLesson: Record<string, number> = {};
    for (const row of rows) {
      byPackage[row.packageId] = (byPackage[row.packageId] ?? 0) + 1;
      const lessonKey = `${row.packageId}:${row.lessonId}`;
      byLesson[lessonKey] = (byLesson[lessonKey] ?? 0) + 1;
    }
    return { global: rows.length, byPackage, byLesson };
  }, [rows]);

  function handleReviewed(submissionId: string) {
    const row = rows.find((item) => item.id === submissionId);
    setRows((current) => current.filter((item) => item.id !== submissionId));
    if (!row) return;
    const key = homeworkReviewedKey(row.studentId, row.lessonId);
    setReviewed((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
    setExpandedStudentKey(null);
  }

  const pendingList = (
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

  const packagePanel = (
    <div className="space-y-3">
      {packages.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No group or 1-1 packages are assigned yet.
        </p>
      ) : (
        packages.map((pack) => {
          const open = expandedPackageId === pack.id;
          const packagePending = counts.byPackage[pack.id] ?? 0;
          return (
            <section
              key={pack.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                onClick={() => {
                  setExpandedPackageId((current) => (current === pack.id ? null : pack.id));
                  setOpenLessonKey(null);
                  setExpandedStudentKey(null);
                }}
                aria-expanded={open}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900">{pack.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {pack.courseName}
                    {pack.kind === "one_to_one" && pack.students.length > 1
                      ? " · Private class"
                      : pack.kind === "one_to_one"
                        ? " · 1-1"
                        : " · Group"}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <PendingCountBadge count={packagePending} />
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-zinc-400 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </span>
              </button>

              {open ? (
                <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                  {pack.lessons.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-zinc-500">
                      No lessons on this course yet.
                    </li>
                  ) : (
                    pack.lessons.map((lesson) => {
                      const lessonKey = `${pack.id}:${lesson.id}`;
                      const lessonOpen = openLessonKey === lessonKey;
                      const lessonPending = counts.byLesson[lessonKey] ?? 0;
                      return (
                        <li key={lesson.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                            onClick={() => {
                              setOpenLessonKey((current) =>
                                current === lessonKey ? null : lessonKey
                              );
                              setExpandedStudentKey(null);
                            }}
                            aria-expanded={lessonOpen}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900">
                                {lesson.title}
                              </p>
                              <p className="mt-0.5 text-xs text-zinc-500">{lesson.weekLabel}</p>
                            </div>
                            <PendingCountBadge count={lessonPending} />
                          </button>

                          {lessonOpen ? (
                            <ul className="space-y-2 bg-zinc-50 px-3 pb-3 pt-1">
                              {pack.students.map((student) => {
                                const { status, submission } = studentRosterStatus(
                                  student.studentId,
                                  lesson.id,
                                  pack.id,
                                  rows,
                                  reviewed
                                );
                                const studentKey = `${lessonKey}:${student.studentId}`;
                                const pill = rosterPill(status);
                                const awaiting = status === "awaiting" && submission;
                                const expanded = expandedStudentKey === studentKey;

                                if (!awaiting) {
                                  return (
                                    <li
                                      key={student.studentId}
                                      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3"
                                    >
                                      <p className="font-medium text-zinc-900">
                                        {student.studentName}
                                      </p>
                                      <span
                                        className={cn(
                                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                                          pill.className
                                        )}
                                      >
                                        {pill.label}
                                      </span>
                                    </li>
                                  );
                                }

                                return (
                                  <li key={student.studentId} className="space-y-2">
                                    <button
                                      type="button"
                                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left hover:bg-zinc-50"
                                      onClick={() =>
                                        setExpandedStudentKey((current) =>
                                          current === studentKey ? null : studentKey
                                        )
                                      }
                                      aria-expanded={expanded}
                                    >
                                      <p className="font-medium text-zinc-900">
                                        {student.studentName}
                                      </p>
                                      <span
                                        className={cn(
                                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                                          pill.className
                                        )}
                                      >
                                        {pill.label}
                                      </span>
                                    </button>
                                    {expanded ? (
                                      <ul>
                                        <HomeworkReviewCard
                                          submission={submission}
                                          onReviewed={handleReviewed}
                                        />
                                      </ul>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })
                  )}
                </ul>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );

  const body = (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Homework review views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pending"}
          onClick={() => setTab("pending")}
          className={cn(
            "inline-flex items-center gap-2",
            tab === "pending" ? ui.pillActive : ui.pillInactive
          )}
        >
          Need to review
          <PendingCountBadge count={counts.global} active={tab === "pending"} />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "packages"}
          onClick={() => setTab("packages")}
          className={cn(tab === "packages" ? ui.pillActive : ui.pillInactive)}
        >
          By package
        </button>
      </div>
      {tab === "pending" ? pendingList : packagePanel}
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
