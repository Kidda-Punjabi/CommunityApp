"use client";

import { useMemo, useState } from "react";
import { WEEK1_BASELINE_FIELDS } from "@/lib/feedback/constants";
import type { FeedbackContext } from "@/lib/feedback/types";
import type { GuestFeedbackSubmitConfig } from "@/lib/public-forms/guest-submit";
import { ui } from "@/lib/ui/styles";

type RatingsState = {
  understanding: number | null;
  speaking: number | null;
  understandingGrammar: number | null;
};

type Week1BaselineFormProps = {
  context: FeedbackContext;
  lessonId?: string | null;
  guestSubmit?: GuestFeedbackSubmitConfig;
};

export function Week1BaselineForm({ context, lessonId, guestSubmit }: Week1BaselineFormProps) {
  const [ratings, setRatings] = useState<RatingsState>({
    understanding: null,
    speaking: null,
    understandingGrammar: null,
  });
  const [comments, setComments] = useState("");
  const [cohort, setCohort] = useState("");
  const [tutor, setTutor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      ratings.understanding != null &&
      ratings.speaking != null &&
      (!guestSubmit || (Boolean(cohort) && Boolean(tutor))),
    [ratings.understanding, ratings.speaking, guestSubmit, cohort, tutor]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canSubmit) {
      setError(
        guestSubmit && (!cohort || !tutor)
          ? "Please choose your cohort and tutor."
          : "Please rate understanding spoken Punjabi and basic speaking."
      );
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        formVariant: "week1",
        lessonId,
        comments,
        understanding: ratings.understanding,
        speaking: ratings.speaking,
      };
      if (ratings.understandingGrammar != null) {
        body.understandingGrammar = ratings.understandingGrammar;
      }
      if (guestSubmit) {
        body.slug = guestSubmit.slug;
        body.fullName = guestSubmit.fullName;
        body.email = guestSubmit.email;
        body.phone = guestSubmit.phone;
        body.cohort = cohort;
        body.tutor = tutor;
      }

      const response = await fetch(guestSubmit?.submitUrl ?? "/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as {
        error?: string;
        notionSynced?: boolean;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to submit starting point.");
      }

      setSuccess(
        data.notionSynced === false
          ? "Thanks — your starting point is saved. We'll sync it to our team shortly."
          : "Thanks for sharing your starting point!"
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit starting point."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`mt-6 ${ui.stack}`}>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">{guestSubmit?.fullName ?? context.fullName}</p>
        <p className="mt-1 text-zinc-500">{guestSubmit?.email ?? context.email}</p>
        {(guestSubmit?.phone ?? context.phone) && (
          <p className="mt-0.5 text-zinc-500">{guestSubmit?.phone ?? context.phone}</p>
        )}
        <dl className="mt-3 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-400">Course</dt>
            <dd>{context.course}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-400">Lesson</dt>
            <dd>{context.lessonLabel}</dd>
          </div>
          {guestSubmit ? (
            <>
              <div className="sm:col-span-2">
                <label className="text-xs uppercase tracking-wide text-zinc-400" htmlFor="week1-cohort">
                  Cohort
                </label>
                <select
                  id="week1-cohort"
                  value={cohort}
                  onChange={(event) => setCohort(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                  required
                >
                  <option value="">Select your cohort</option>
                  {guestSubmit.cohorts.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs uppercase tracking-wide text-zinc-400" htmlFor="week1-tutor">
                  Tutor
                </label>
                <select
                  id="week1-tutor"
                  value={tutor}
                  onChange={(event) => setTutor(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                  required
                >
                  <option value="">Select your tutor</option>
                  {guestSubmit.tutors.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-400">Cohort</dt>
                <dd>{context.cohort}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-400">Tutor</dt>
                <dd>{context.tutor ?? "Not assigned"}</dd>
              </div>
            </>
          )}
        </dl>
        {!guestSubmit && context.tutorUnmatched && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Your tutor name didn&apos;t match our Notion list — we&apos;ve flagged this for
            the team to review.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {WEEK1_BASELINE_FIELDS.map((field) => (
          <StarRatingField
            key={field.key}
            label={field.label}
            required={field.required}
            value={ratings[field.key]}
            onChange={(value) =>
              setRatings((prev) => ({ ...prev, [field.key]: value }))
            }
          />
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Final comments (optional)
        </label>
        <textarea
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Is there anything you’d like us or the tutor to improve, or any feedback you’d like to share for future sessions?"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !canSubmit || Boolean(success)}
        className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit starting point"}
      </button>
    </form>
  );
}

function StarRatingField({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required: boolean;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-800">{label}</span>
        <span className="text-xs text-zinc-400">
          {value ? `${value}/5` : required ? "Required" : "Optional"}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`rounded px-2 py-1 text-lg leading-none ${
              value && star <= value ? "text-amber-500" : "text-zinc-300"
            }`}
            aria-label={`${label}: ${star} out of 5`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
