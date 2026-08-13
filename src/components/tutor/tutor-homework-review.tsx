"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getHomeworkPlaybackUrl,
  reviewHomeworkSubmission,
} from "@/app/dashboard/tutor/homework-actions";
import type { PendingHomeworkReviewRow } from "@/lib/tutoring/homework-submissions";
import { ui } from "@/lib/ui/styles";

type TutorHomeworkReviewProps = {
  submissions: PendingHomeworkReviewRow[];
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

export function TutorHomeworkReview({
  submissions,
  fullPage = false,
}: TutorHomeworkReviewProps) {
  const [rows, setRows] = useState(submissions);

  useEffect(() => {
    setRows(submissions);
  }, [submissions]);

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
              onReviewed={(submissionId) => {
                setRows((current) => current.filter((row) => row.id !== submissionId));
              }}
            />
          ))}
        </ul>
      )}
    </>
  );

  if (fullPage) {
    return list;
  }

  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Homework review</h2>
      {list}
    </section>
  );
}
