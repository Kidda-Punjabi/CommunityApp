"use client";

import { useEffect, useState } from "react";
import { LessonFeedbackForm } from "@/components/feedback/lesson-feedback-form";
import type { FeedbackContext } from "@/lib/feedback/types";

type LessonFeedbackPanelProps = {
  lessonId: string;
  title?: string;
  description?: string;
};

export function LessonFeedbackPanel({
  lessonId,
  title = "How was this lesson?",
  description = "Your feedback helps us improve lessons and support you better.",
}: LessonFeedbackPanelProps) {
  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [testimonialCalendarUrl, setTestimonialCalendarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/feedback/context?lessonId=${encodeURIComponent(lessonId)}`
        );
        const data = (await response.json()) as {
          context?: FeedbackContext;
          testimonialCalendarUrl?: string | null;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load feedback form.");
        }
        if (!cancelled) {
          setContext(data.context ?? null);
          setTestimonialCalendarUrl(data.testimonialCalendarUrl ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load feedback form."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (submitted && context?.formVariant !== "week12") return null;

  return (
    <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/40 p-5 text-left">
      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{description}</p>

      {loading && <p className="mt-4 text-sm text-zinc-500">Loading your details…</p>}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {context && (
        <LessonFeedbackForm
          context={context}
          lessonId={lessonId}
          compact
          testimonialCalendarUrl={testimonialCalendarUrl}
          onSubmitted={() => setSubmitted(true)}
        />
      )}
    </div>
  );
}
