"use client";

import { LessonFeedbackForm } from "@/components/feedback/lesson-feedback-form";
import { Week1BaselineForm } from "@/components/feedback/week1-baseline-form";
import { PublicFormFrame } from "@/components/public-forms/public-form-frame";
import type { FeedbackContext } from "@/lib/feedback/types";
import type { PublicFeedbackTarget } from "@/lib/public-forms/feedback-target";
import type { GuestIdentity } from "@/lib/public-forms/guest";
import { PUBLIC_FEEDBACK_TUTOR_OPTIONS } from "@/lib/public-forms/options";
import { uploadPublicFeedbackPhoto } from "@/lib/public-forms/upload-public-photo";

export function PublicFeedbackForm({
  slug,
  heading,
  target,
  context,
  cohorts,
  testimonialCalendarUrl,
}: {
  slug: string;
  heading: { kicker: string; title: string; intro: string };
  target: PublicFeedbackTarget;
  context: FeedbackContext;
  cohorts: string[];
  testimonialCalendarUrl?: string | null;
}) {
  return (
    <PublicFormFrame heading={heading}>
      {(identity) => (
        <PublicFeedbackRun
          slug={slug}
          identity={identity}
          target={target}
          context={context}
          cohorts={cohorts}
          testimonialCalendarUrl={testimonialCalendarUrl}
        />
      )}
    </PublicFormFrame>
  );
}

function PublicFeedbackRun({
  slug,
  identity,
  target,
  context,
  cohorts,
  testimonialCalendarUrl,
}: {
  slug: string;
  identity: GuestIdentity;
  target: PublicFeedbackTarget;
  context: FeedbackContext;
  cohorts: string[];
  testimonialCalendarUrl?: string | null;
}) {
  const guestSubmit = {
    slug,
    submitUrl: "/api/public/feedback/submit",
    fullName: identity.fullName,
    email: identity.email,
    phone: identity.phone,
    cohorts,
    tutors: PUBLIC_FEEDBACK_TUTOR_OPTIONS,
    uploadPhoto: (file: File) => uploadPublicFeedbackPhoto(slug, file),
  };

  const filledContext: FeedbackContext = {
    ...context,
    fullName: identity.fullName,
    email: identity.email,
    phone: identity.phone,
  };

  if (target.formVariant === "week1") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <Week1BaselineForm
          context={filledContext}
          lessonId={filledContext.lessonId}
          guestSubmit={guestSubmit}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <LessonFeedbackForm
        context={filledContext}
        lessonId={filledContext.lessonId}
        guestSubmit={guestSubmit}
        compact
        testimonialCalendarUrl={testimonialCalendarUrl}
      />
    </div>
  );
}
