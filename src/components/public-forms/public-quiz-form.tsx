"use client";

import { useCallback, useRef, useState } from "react";
import { PublicFormFrame } from "@/components/public-forms/public-form-frame";
import type { PublicQuizView } from "@/components/public-forms/public-quiz-types";
import type { GuestIdentity } from "@/lib/public-forms/guest";
import { QuizPlayer } from "@/components/quiz-player";

export function PublicQuizForm({
  slug,
  heading,
  quiz,
}: {
  slug: string;
  heading: { kicker: string; title: string; intro: string };
  quiz: PublicQuizView;
}) {
  return (
    <PublicFormFrame heading={heading}>
      {(identity) => <PublicQuizRun slug={slug} identity={identity} quiz={quiz} />}
    </PublicFormFrame>
  );
}

function PublicQuizRun({
  slug,
  identity,
  quiz,
}: {
  slug: string;
  identity: GuestIdentity;
  quiz: PublicQuizView;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const handleComplete = useCallback(
    async (scorePercent: number) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setStatus("saving");
      setError(null);

      try {
        const response = await fetch("/api/public/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            fullName: identity.fullName,
            email: identity.email,
            phone: identity.phone,
            score: scorePercent,
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to save your score.");
        }
        setStatus("saved");
      } catch (submitError) {
        submittedRef.current = false;
        setStatus("error");
        setError(
          submitError instanceof Error ? submitError.message : "Unable to save your score."
        );
      }
    },
    [identity, slug]
  );

  return (
    <div className="space-y-3">
      <QuizPlayer
        quizId={quiz.quizId}
        quizTitle={quiz.quizTitle}
        courseName={quiz.courseName}
        lessonNumber={quiz.lessonNumber}
        questions={quiz.questions}
        hideLoggedInChrome
        onComplete={handleComplete}
      />
      {status === "saving" && (
        <p className="text-center text-sm text-zinc-500">Saving your score…</p>
      )}
      {status === "saved" && (
        <p className="text-center text-sm text-green-700">We've saved your score.</p>
      )}
      {status === "error" && error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
