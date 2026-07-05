"use client";

import { useState, useTransition } from "react";
import { submitTextHomeworkAction } from "@/app/catchup/catchup-actions";
import type { HomeworkTextQuestion } from "@/lib/catchup/load-segment-questions";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import { ui } from "@/lib/ui/styles";

type CatchupWrittenHomeworkProps = {
  lessonId: string;
  questions: HomeworkTextQuestion[];
  existingSubmission: HomeworkSubmissionView | null;
  onComplete: () => void;
};

export function CatchupWrittenHomework({
  lessonId,
  questions,
  existingSubmission,
  onComplete,
}: CatchupWrittenHomeworkProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (existingSubmission?.status === "reviewed") {
    return (
      <div className="space-y-3">
        <div
          className={`rounded-2xl px-4 py-3 ${
            existingSubmission.approved ? "bg-green-50" : "bg-amber-50"
          }`}
        >
          <p className="text-sm font-semibold text-zinc-900">
            {existingSubmission.approved
              ? "Homework approved — great work!"
              : "Your tutor left feedback on your homework."}
          </p>
          {existingSubmission.tutorComment ? (
            <p className="mt-2 text-sm text-zinc-700">{existingSubmission.tutorComment}</p>
          ) : null}
        </div>
        <button type="button" onClick={onComplete} className={ui.btnPrimary}>
          Finish lesson
        </button>
      </div>
    );
  }

  if (existingSubmission?.status === "pending_review") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-violet-50 px-4 py-3">
          <p className="text-sm font-semibold text-violet-900">Homework submitted</p>
          <p className="mt-1 text-sm text-violet-700">
            Your tutor will review your written answers soon.
          </p>
        </div>
        <button type="button" onClick={onComplete} className={ui.btnPrimary}>
          Finish lesson
        </button>
      </div>
    );
  }

  function handleSubmit() {
    setError(null);
    setSuccess(null);

    const payload = questions.map((question) => ({
      question_number: question.questionNumber,
      answer_text: (answers[question.questionNumber] ?? "").trim(),
    }));

    if (payload.some((row) => !row.answer_text)) {
      setError("Please answer every question before submitting.");
      return;
    }

    startTransition(async () => {
      const result = await submitTextHomeworkAction(lessonId, payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Homework submitted!");
    });
  }

  if (success) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-700">{success}</p>
        <button type="button" onClick={onComplete} className={ui.btnPrimary}>
          Finish lesson
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {questions.map((question) => (
          <li key={question.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-sm font-medium text-zinc-900">
              {question.questionNumber}. Translate: {question.promptEnglish}
            </p>
            <textarea
              rows={2}
              value={answers[question.questionNumber] ?? ""}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [question.questionNumber]: event.target.value,
                }))
              }
              placeholder="Write your Punjabi sentence (romanised is fine)"
              className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </li>
        ))}
      </ol>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="button" disabled={pending} onClick={handleSubmit} className={ui.btnPrimary}>
        {pending ? "Submitting…" : "Submit homework"}
      </button>
    </div>
  );
}
