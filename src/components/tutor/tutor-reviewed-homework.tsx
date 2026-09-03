"use client";

import { useState } from "react";
import { HomeworkAudioPlayer } from "@/components/homework/homework-audio-player";
import { HomeworkTextAnswers } from "@/components/homework/homework-text-answers";
import type { ReviewedHomeworkRow } from "@/lib/tutoring/homework-submissions";
import { ui } from "@/lib/ui/styles";

type TutorReviewedHomeworkProps = {
  submissions: ReviewedHomeworkRow[];
};

function formatReviewedAt(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function ReviewedCard({ submission }: { submission: ReviewedHomeworkRow }) {
  const reviewedOn = formatReviewedAt(submission.reviewedAt);

  return (
    <li className={ui.cardBordered}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-900">{submission.studentName}</p>
          <p className="mt-1 text-sm text-zinc-600">
            Lesson {submission.lessonNumber}: {submission.lessonTitle}
          </p>
          {reviewedOn ? (
            <p className="mt-1 text-xs text-zinc-500">Reviewed {reviewedOn}</p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            submission.approved
              ? "bg-green-100 text-green-900"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {submission.approved ? "Approved" : "Needs improvement"}
        </span>
      </div>

      <div className="mt-4">
        {submission.submissionType === "text" ? (
          <HomeworkTextAnswers
            textAnswers={submission.textAnswers}
            answerKeys={submission.answerKeys}
          />
        ) : submission.storagePath ? (
          <HomeworkAudioPlayer
            storagePath={submission.storagePath}
            durationSeconds={submission.durationSeconds}
          />
        ) : (
          <p className="text-sm text-zinc-500">No recording attached.</p>
        )}
      </div>

      {submission.tutorComment ? (
        <p className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Your feedback: {submission.tutorComment}
        </p>
      ) : null}
    </li>
  );
}

export function TutorReviewedHomework({ submissions }: TutorReviewedHomeworkProps) {
  const [expanded, setExpanded] = useState(false);

  if (submissions.length === 0) return null;

  return (
    <section className={ui.section}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-zinc-900">Already reviewed</h2>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={ui.btnGhost}
        >
          {expanded ? "Hide" : `Show (${submissions.length})`}
        </button>
      </div>

      {expanded ? (
        <ul className="space-y-4">
          {submissions.map((submission) => (
            <ReviewedCard key={submission.id} submission={submission} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          Recordings you have already marked stay here so you can listen again.
        </p>
      )}
    </section>
  );
}
