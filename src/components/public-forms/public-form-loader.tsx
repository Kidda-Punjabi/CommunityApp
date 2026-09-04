"use client";

import dynamic from "next/dynamic";
import type { FeedbackContext } from "@/lib/feedback/types";
import type { PublicFeedbackTarget } from "@/lib/public-forms/feedback-target";
import type { PublicQuizView } from "@/components/public-forms/public-quiz-types";

const PublicQuizForm = dynamic(
  () => import("@/components/public-forms/public-quiz-form").then((mod) => mod.PublicQuizForm),
  { loading: () => <p className="text-sm text-zinc-500">Loading…</p> }
);

const PublicFeedbackForm = dynamic(
  () =>
    import("@/components/public-forms/public-feedback-form").then((mod) => mod.PublicFeedbackForm),
  { loading: () => <p className="text-sm text-zinc-500">Loading…</p> }
);

type PublicFormLoaderProps =
  | {
      formType: "quiz";
      slug: string;
      heading: { kicker: string; title: string; intro: string };
      quiz: PublicQuizView;
    }
  | {
      formType: "feedback";
      slug: string;
      heading: { kicker: string; title: string; intro: string };
      target: PublicFeedbackTarget;
      context: FeedbackContext;
      cohorts: string[];
      testimonialCalendarUrl?: string | null;
    };

export function PublicFormLoader(props: PublicFormLoaderProps) {
  if (props.formType === "quiz") {
    return <PublicQuizForm slug={props.slug} heading={props.heading} quiz={props.quiz} />;
  }

  return (
    <PublicFeedbackForm
      slug={props.slug}
      heading={props.heading}
      target={props.target}
      context={props.context}
      cohorts={props.cohorts}
      testimonialCalendarUrl={props.testimonialCalendarUrl}
    />
  );
}
