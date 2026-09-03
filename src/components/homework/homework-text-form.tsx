"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getCatchupHomeworkNearLessonWarning,
  submitTextHomeworkAction,
} from "@/app/catchup/catchup-actions";
import type { HomeworkTextQuestion } from "@/lib/catchup/load-segment-questions";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import { ui } from "@/lib/ui/styles";

type HomeworkTextFormProps = {
  lessonId: string;
  questions: HomeworkTextQuestion[];
  existingSubmission: HomeworkSubmissionView | null;
};

function submittedAnswer(
  submission: HomeworkSubmissionView,
  questionNumber: number
): string | null {
  const match = submission.textAnswers?.find((row) => row.question_number === questionNumber);
  return match?.answer_text?.trim() ? match.answer_text : null;
}

export function HomeworkTextForm({
  lessonId,
  questions,
  existingSubmission,
}: HomeworkTextFormProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nearLessonWarning, setNearLessonWarning] = useState<string | null>(null);
  const [timingTone, setTimingTone] = useState<"late" | "post_lesson">("late");
  const [pending, startTransition] = useTransition();
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (existingSubmission) {
      setNearLessonWarning(null);
      return;
    }

    let cancelled = false;
    getCatchupHomeworkNearLessonWarning(lessonId).then((result) => {
      if (cancelled) return;
      setNearLessonWarning(result.nearLessonWarning ?? null);
      setTimingTone(result.timingState === "post_lesson" ? "post_lesson" : "late");
    });

    return () => {
      cancelled = true;
    };
  }, [existingSubmission, lessonId]);

  if (existingSubmission?.status === "reviewed") {
    return (
      <div className="space-y-4">
        <div
          className={`rounded-2xl px-4 py-3 ${
            existingSubmission.approved ? "bg-green-50" : "bg-amber-50"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              existingSubmission.approved ? "text-green-800" : "text-amber-900"
            }`}
          >
            {existingSubmission.approved
              ? "Great work — approved!"
              : "Keep going — your tutor left some tips"}
          </p>
          {existingSubmission.tutorComment ? (
            <p className="mt-2 text-sm text-zinc-700">{existingSubmission.tutorComment}</p>
          ) : null}
        </div>
        <ol className="space-y-3">
          {questions.map((question) => (
            <li
              key={question.id}
              className="rounded-3xl border border-zinc-200/60 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                {question.questionNumber} of {questions.length}
              </p>
              <p className="mt-1 text-base font-medium text-zinc-900">{question.promptEnglish}</p>
              <p className="mt-3 text-sm text-zinc-700">
                {submittedAnswer(existingSubmission, question.questionNumber) ?? "—"}
              </p>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (existingSubmission?.status === "pending_review") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-violet-50 px-4 py-3">
          <p className="text-sm font-semibold text-violet-800">In review</p>
          <p className="mt-1 text-sm text-violet-700">
            Your tutor is reviewing your homework. You will get a notification when they have
            feedback.
          </p>
        </div>
        <ol className="space-y-3">
          {questions.map((question) => (
            <li
              key={question.id}
              className="rounded-3xl border border-zinc-200/60 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                {question.questionNumber} of {questions.length}
              </p>
              <p className="mt-1 text-base font-medium text-zinc-900">{question.promptEnglish}</p>
              <p className="mt-3 text-sm text-zinc-700">
                {submittedAnswer(existingSubmission, question.questionNumber) ?? "—"}
              </p>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  function handleSubmit() {
    if (submitLockRef.current || pending) return;
    submitLockRef.current = true;
    setError(null);
    setSuccess(null);

    const payload = questions.map((question) => ({
      question_number: question.questionNumber,
      answer_text: (answers[question.questionNumber] ?? "").trim(),
    }));

    if (payload.some((row) => !row.answer_text)) {
      submitLockRef.current = false;
      setError("Please answer every question before submitting.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitTextHomeworkAction(lessonId, payload);
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(result.success ?? "Homework submitted!");
        router.refresh();
      } finally {
        submitLockRef.current = false;
      }
    });
  }

  return (
    <div className="space-y-4">
      {nearLessonWarning ? (
        <div
          className={
            timingTone === "post_lesson"
              ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3"
              : "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
          }
        >
          <p
            className={
              timingTone === "post_lesson" ? "text-sm text-rose-950" : "text-sm text-amber-950"
            }
          >
            {nearLessonWarning}
          </p>
        </div>
      ) : null}

      <ol className="space-y-3">
        {questions.map((question) => (
          <li
            key={question.id}
            className="rounded-3xl border border-zinc-200/60 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
              {question.questionNumber} of {questions.length}
            </p>
            <p className="mt-1 text-base font-medium text-zinc-900">{question.promptEnglish}</p>
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
              aria-label={`Answer for question ${question.questionNumber}`}
            />
          </li>
        ))}
      </ol>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}
      <button type="button" disabled={pending} onClick={handleSubmit} className={ui.btnPrimaryBlock}>
        {pending ? "Submitting…" : "Submit homework"}
      </button>
    </div>
  );
}
