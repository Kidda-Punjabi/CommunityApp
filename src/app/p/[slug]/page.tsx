import { PublicFormLoader } from "@/components/public-forms/public-form-loader";
import type { FeedbackContext } from "@/lib/feedback/types";
import { parsePublicFeedbackTarget, publicFeedbackCopy } from "@/lib/public-forms/feedback-target";
import { lookupPublicFormLinkBySlug } from "@/lib/public-forms/links";
import { loadPublicFormSelectOptions } from "@/lib/public-forms/load-cohort-options";
import { loadCourseLessonId, loadPublicQuizById } from "@/lib/public-forms/load-quiz";
import { publicCohortAudienceFromCourse } from "@/lib/public-forms/options";
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

    const audience = publicCohortAudienceFromCourse({
      courseName: quiz.courseName,
      contentTrack: quiz.contentTrack,
    });
    const { cohorts, tutors } = await loadPublicFormSelectOptions(audience);

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
        audience={audience}
        cohorts={cohorts}
        tutors={tutors}
      />
    );
  }

  const target = parsePublicFeedbackTarget(link.targetId);
  if (!target) notFound();

  const [{ cohorts, tutors }, lessonId] = await Promise.all([
    loadPublicFormSelectOptions(publicCohortAudienceFromCourse({ courseName: target.course })),
    loadCourseLessonId(target.course, target.lessonNumber),
  ]);

  const context: FeedbackContext = {
    fullName: "",
    email: "",
    phone: null,
    cohort: "",
    course: target.course,
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
      tutors={tutors}
      testimonialCalendarUrl={
        target.formVariant === "week12" ? getTestimonialCalendarUrl() : null
      }
    />
  );
}
