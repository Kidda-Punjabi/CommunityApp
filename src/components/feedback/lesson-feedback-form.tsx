"use client";

import { useMemo, useState } from "react";
import { TestimonialBookingWidget } from "@/components/feedback/testimonial-booking-widget";
import {
  FUTURE_SUPPORT_OPTIONS,
  STANDARD_RATING_FIELDS,
  WEEK12_EXTRA_RATING_FIELDS,
  type RatingFieldKey,
} from "@/lib/feedback/constants";
import type { FeedbackContext } from "@/lib/feedback/types";
import { uploadFeedbackPhoto } from "@/lib/feedback/upload-photo";
import type { GuestFeedbackSubmitConfig } from "@/lib/public-forms/guest-submit";
import { ui } from "@/lib/ui/styles";

type RatingsState = Partial<Record<RatingFieldKey, number | null>>;

function emptyRatings(isWeek12: boolean): RatingsState {
  const fields = isWeek12
    ? [...STANDARD_RATING_FIELDS, ...WEEK12_EXTRA_RATING_FIELDS]
    : STANDARD_RATING_FIELDS;
  return Object.fromEntries(fields.map((field) => [field.key, null]));
}

type LessonFeedbackFormProps = {
  context: FeedbackContext;
  lessonId?: string | null;
  sessionId?: string | null;
  onSubmitted?: () => void;
  compact?: boolean;
  guestSubmit?: GuestFeedbackSubmitConfig;
  testimonialCalendarUrl?: string | null;
};

export function LessonFeedbackForm({
  context,
  lessonId,
  sessionId,
  onSubmitted,
  compact = false,
  guestSubmit,
  testimonialCalendarUrl,
}: LessonFeedbackFormProps) {
  const isWeek12 = context.formVariant === "week12";
  const isCommunity = context.formVariant === "community";
  const ratingFields = isWeek12
    ? [...STANDARD_RATING_FIELDS, ...WEEK12_EXTRA_RATING_FIELDS]
    : STANDARD_RATING_FIELDS;

  const [ratings, setRatings] = useState<RatingsState>(() => emptyRatings(isWeek12));
  const [comments, setComments] = useState("");
  const [recommend, setRecommend] = useState<"Yes" | "No" | null>(null);
  const [videoTestimonial, setVideoTestimonial] = useState<"Yes" | "No">("No");
  const [includeTestimonial, setIncludeTestimonial] = useState(false);
  const [testimonials, setTestimonials] = useState("");
  const [futureSupport, setFutureSupport] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cohort, setCohort] = useState("");
  const [tutor, setTutor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const allRated = useMemo(
    () => ratingFields.every((field) => ratings[field.key] != null),
    [ratingFields, ratings]
  );

  const canSubmit =
    allRated &&
    (!isWeek12 || recommend !== null) &&
    (!guestSubmit || (Boolean(cohort) && Boolean(tutor)));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canSubmit) {
      setError(
        guestSubmit && (!cohort || !tutor)
          ? "Please choose your cohort and tutor."
          : isWeek12
            ? "Please complete all ratings and the recommend question."
            : "Please complete all ratings."
      );
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        formVariant: context.formVariant,
        lessonId: lessonId ?? context.lessonId,
        sessionId: sessionId ?? context.sessionId,
        comments,
        ...ratings,
      };

      if (guestSubmit) {
        body.slug = guestSubmit.slug;
        body.fullName = guestSubmit.fullName;
        body.email = guestSubmit.email;
        body.phone = guestSubmit.phone;
        body.cohort = cohort;
        body.tutor = tutor;
      }

      if (isWeek12) {
        body.recommend = recommend;
        body.videoTestimonial = videoTestimonial;
        body.includeTestimonial = includeTestimonial;
        body.testimonials = includeTestimonial ? testimonials : null;
        body.futureSupport = futureSupport;
        if (photoFile) {
          const upload = guestSubmit?.uploadPhoto ?? uploadFeedbackPhoto;
          body.pictureUrl = await upload(photoFile);
        }
      }

      const response = await fetch(guestSubmit?.submitUrl ?? "/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as {
        error?: string;
        notionSynced?: boolean;
        notionError?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to submit feedback.");
      }

      if (data.notionSynced === false) {
        setSuccess(
          "Thanks — your feedback is saved. We'll sync it to our team shortly."
        );
      } else {
        setSuccess(
          isWeek12
            ? "Thanks for sharing your course feedback!"
            : "Thanks for your feedback!"
        );
      }

      onSubmitted?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit feedback."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function toggleFutureSupport(option: string) {
    setFutureSupport((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} className={compact ? "space-y-5" : `mt-6 ${ui.stack}`}>
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
            <dt className="text-xs uppercase tracking-wide text-zinc-400">
              {isCommunity ? "Session" : "Lesson"}
            </dt>
            <dd>{context.lessonLabel}</dd>
          </div>
          {guestSubmit ? (
            <>
              <div className="sm:col-span-2">
                <label className="text-xs uppercase tracking-wide text-zinc-400" htmlFor="public-cohort">
                  Cohort
                </label>
                <select
                  id="public-cohort"
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
                <label className="text-xs uppercase tracking-wide text-zinc-400" htmlFor="public-tutor">
                  Tutor
                </label>
                <select
                  id="public-tutor"
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

      {isWeek12 && (
        <p className="text-sm text-zinc-600">
          You&apos;ve finished the Beginners Course — this is our end-of-course survey. Thank
          you for learning with Kidda!
        </p>
      )}

      <div className="space-y-4">
        {ratingFields.map((field) => (
          <StarRatingField
            key={field.key}
            label={field.label}
            value={ratings[field.key] ?? null}
            onChange={(value) =>
              setRatings((prev) => ({ ...prev, [field.key]: value }))
            }
          />
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Comments</label>
        <textarea
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          placeholder={
            isWeek12
              ? "How did you find the course overall?"
              : isCommunity
                ? "How was this Community Class?"
                : "How was this lesson for you?"
          }
        />
      </div>

      {isWeek12 && (
        <>
          <YesNoField
            label="Would you recommend Kidda to a friend?"
            value={recommend}
            onChange={setRecommend}
          />

          <YesNoField
            label="Would you be open to a video testimonial?"
            value={videoTestimonial}
            onChange={setVideoTestimonial}
          />

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={includeTestimonial}
              onChange={(event) => setIncludeTestimonial(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-violet-600"
            />
            I&apos;d like to share a written testimonial
          </label>

          {includeTestimonial && (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Testimonial</label>
              <textarea
                value={testimonials}
                onChange={(event) => setTestimonials(event.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {(videoTestimonial === "Yes" || includeTestimonial) && (
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Photo (optional)
              </label>
              <p className="mt-1 text-xs text-zinc-500">
                If you&apos;re happy to, add a photo of yourself to go with your testimonial.
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-violet-700"
              />
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-zinc-700">
              What would help you most going forward? (optional)
            </legend>
            <div className="mt-2 space-y-2">
              {FUTURE_SUPPORT_OPTIONS.map((option) => (
                <label key={option} className="flex items-start gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={futureSupport.includes(option)}
                    onChange={() => toggleFutureSupport(option)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-violet-600"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

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
        {submitting ? "Submitting…" : "Submit feedback"}
      </button>
    </form>
    {success &&
      isWeek12 &&
      videoTestimonial === "Yes" &&
      testimonialCalendarUrl && (
        <TestimonialBookingWidget
          calendarUrl={testimonialCalendarUrl}
          fullName={guestSubmit?.fullName ?? context.fullName}
          email={guestSubmit?.email ?? context.email}
          phone={guestSubmit?.phone ?? context.phone ?? ""}
        />
      )}
    </>
  );
}

function StarRatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-800">{label}</span>
        <span className="text-xs text-zinc-400">{value ? `${value}/5` : "Required"}</span>
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

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "Yes" | "No" | null;
  onChange: (value: "Yes" | "No") => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <div className="mt-2 flex gap-2">
        {(["Yes", "No"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              value === option
                ? "bg-violet-600 text-white"
                : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
