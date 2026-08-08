"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Layers, ListChecks } from "lucide-react";
import { markEnglishModuleComplete } from "@/app/dashboard/english/actions";
import { deckPracticeHref } from "@/lib/flashcards/utils";
import { isQuizPassing } from "@/lib/progress/quiz-progress";
import type { FlashcardSetInfo } from "@/lib/learning/match-lesson-content";
import type { LessonCompletionStatus } from "@/lib/progress/lesson-completion";
import type { QuizProgressRow } from "@/lib/progress/quiz-progress";
import { cn } from "@/lib/ui/styles";

export type EnglishModuleQuizLink = {
  id: string;
  title: string;
  questionCount: number;
};

type EnglishModuleActivitiesProps = {
  lessonId: string;
  title: string;
  completion: LessonCompletionStatus | undefined;
  flashcardSets: FlashcardSetInfo[];
  quiz: EnglishModuleQuizLink | null;
  quizProgress: QuizProgressRow | undefined;
  returnPath: string;
};

export function EnglishModuleActivities({
  lessonId,
  title,
  completion,
  flashcardSets,
  quiz,
  quizProgress,
  returnPath,
}: EnglishModuleActivitiesProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const returnQuery = encodeURIComponent(returnPath);
  const flashcardsComplete = completion?.flashcardsComplete ?? false;
  const flashcardsRequired =
    completion?.flashcardsRequired ?? flashcardSets.length > 0;
  const quizRequired = Boolean(quiz);
  const quizPassed = quiz
    ? isQuizPassing(quizProgress, quiz.questionCount)
    : true;
  const moduleComplete = Boolean(completion?.fullyComplete);
  const hasActivities = flashcardSets.length > 0 || quizRequired;
  const totalCards = flashcardSets.reduce((sum, set) => sum + set.cardCount, 0);

  function onMarkComplete() {
    setError(null);
    startTransition(async () => {
      const result = await markEnglishModuleComplete(lessonId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/english");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          Module
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Practice the activities below to complete this module and unlock the next.
        </p>
      </div>

      {moduleComplete ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Check className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
          <div>
            <p className="font-semibold">Module complete</p>
            <p className="mt-0.5 text-emerald-800/80">
              You can revisit activities anytime, or continue on the path.
            </p>
            <Link
              href="/dashboard/english"
              className="mt-2 inline-flex text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
            >
              Back to path →
            </Link>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {flashcardSets.map((set) => {
          const href = `${deckPracticeHref(lessonId, set.deckId, "study")}?catchupReturn=${returnQuery}`;
          const setDone = flashcardsComplete;
          return (
            <Link
              key={set.deckId}
              href={href}
              className={cn(
                "flex items-center gap-4 rounded-2xl border bg-white px-4 py-4 transition-colors",
                setDone
                  ? "border-emerald-200 hover:border-emerald-300"
                  : "border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50/40"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  setDone
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-emerald-50 text-emerald-700"
                )}
              >
                {setDone ? (
                  <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                ) : (
                  <Layers className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-900">
                  {set.name || "Flashcards"}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {set.cardCount} card{set.cardCount === 1 ? "" : "s"}
                  {setDone ? " · All confident" : " · Mark each card confident"}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-emerald-700">
                {setDone ? "Done" : "Practice"}
              </span>
            </Link>
          );
        })}

        {quiz ? (
          <Link
            href={`/dashboard/practice/quiz/${quiz.id}?catchupReturn=${returnQuery}`}
            className={cn(
              "flex items-center gap-4 rounded-2xl border bg-white px-4 py-4 transition-colors",
              quizPassed
                ? "border-emerald-200 hover:border-emerald-300"
                : "border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50/40"
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                quizPassed
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              )}
            >
              {quizPassed ? (
                <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              ) : (
                <ListChecks className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-zinc-900">
                {quiz.title || "Check"}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}
                {quizPassed ? " · Passed" : " · Pass to complete"}
              </span>
            </span>
            <span className="shrink-0 text-sm font-medium text-emerald-700">
              {quizPassed ? "Done" : "Start"}
            </span>
          </Link>
        ) : null}
      </div>

      {!hasActivities ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
          <p className="text-sm text-zinc-600">
            No practice activities are attached to this module yet. You can mark it
            complete to continue.
          </p>
          <button
            type="button"
            onClick={onMarkComplete}
            disabled={pending || moduleComplete}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {moduleComplete
              ? "Already complete"
              : pending
                ? "Saving…"
                : "Mark module complete"}
          </button>
        </div>
      ) : null}

      {hasActivities &&
      !moduleComplete &&
      flashcardsRequired &&
      !flashcardsComplete ? (
        <p className="text-center text-xs text-zinc-500">
          {totalCards > 0
            ? `Complete the flashcards${quizRequired ? " and quiz" : ""} to unlock the next module.`
            : "Complete the activities to unlock the next module."}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
