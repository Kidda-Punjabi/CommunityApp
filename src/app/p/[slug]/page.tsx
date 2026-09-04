import { PublicFormLoader } from "@/components/public-forms/public-form-loader";
import type { FeedbackContext } from "@/lib/feedback/types";
import { parsePublicFeedbackTarget, publicFeedbackCopy } from "@/lib/public-forms/feedback-target";
import { lookupPublicFormLinkBySlug } from "@/lib/public-forms/links";
import { loadPublicCohortOptions } from "@/lib/public-forms/load-cohort-options";
import { loadBeginnersLessonId, loadPublicQuizById } from "@/lib/public-forms/load-quiz";
import { getTestimonialCalendarUrl } from "@/lib/ghl/testimonial-calendar";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicFormPage({ params }: PageProps) {
  const { slug } = await params;
  const link = await lookupPublicFormLinkBySlug(slug);
  if (!link) notFound();

  if (link.formType === "quiz") {
    const quiz = await loadPublicQuizById(link.targetId);
    if (!quiz) notFound();

    return (
      <PublicFormLoader
        formType="quiz"
        slug={link.slug}
        heading={{
          kicker: "Quiz",
          title: quiz.quizTitle,
          intro: "Answer each question. Your score is saved at the end.",
        }}
        quiz={quiz}
      />
    );
  }

  const target = parsePublicFeedbackTarget(link.targetId);
  if (!target) notFound();

  const [cohorts, lessonId] = await Promise.all([
    loadPublicCohortOptions(),
    loadBeginnersLessonId(target.lessonNumber),
  ]);

  const context: FeedbackContext = {
    fullName: "",
    email: "",
    phone: null,
    cohort: "",
    course: "Beginners Course",
    lessonLabel: target.lessonLabel,
    lessonNumber: target.lessonNumber,
    tutor: null,
    notionTutor: null,
    tutorUnmatched: false,
    lessonId,
    sessionId: null,
    formVariant: target.formVariant,
  };

  return (
    <PublicFormLoader
      formType="feedback"
      slug={link.slug}
      heading={publicFeedbackCopy(target)}
      target={target}
      context={context}
      cohorts={cohorts}
      testimonialCalendarUrl={
        target.formVariant === "week12" ? getTestimonialCalendarUrl() : null
      }
    />
  );
}
