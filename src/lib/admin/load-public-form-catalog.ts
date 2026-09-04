import "server-only";

import { getPublicAppUrl } from "@/lib/app-url";
import { parsePublicFeedbackTarget, publicFeedbackCopy } from "@/lib/public-forms/feedback-target";
import { listPublicFormLinks } from "@/lib/public-forms/links";
import { isUuid } from "@/lib/public-forms/load-quiz";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

export type PublicFormCatalogQuiz = {
  slug: string;
  label: string;
  href: string;
  quizId: string;
  questionCount: number;
  lessonNumber: number | null;
};

export type PublicFormCatalogFeedback = {
  slug: string;
  label: string;
  href: string;
  targetId: string;
  formVariant: "standard" | "week1" | "week12";
  lessonLabel: string;
  studentTitle: string;
  notionCourse: string;
  mappingNote: string;
};

export type PublicFormCatalog = {
  quizzes: PublicFormCatalogQuiz[];
  feedback: PublicFormCatalogFeedback[];
  error?: string;
};

function quizSortKey(label: string): [number, number] {
  const recap = /^Week (\d+) Recap Quiz$/i.exec(label);
  if (recap) return [0, Number.parseInt(recap[1], 10)];
  if (label.includes("1-4")) return [1, 1];
  if (label.includes("5-7")) return [1, 2];
  if (label.includes("8-10")) return [1, 3];
  return [2, 0];
}

function feedbackSortKey(targetId: string): number {
  if (targetId === "week-1-starting-point") return 0;
  if (targetId === "week-1-session") return 1;
  const match = /^week-(\d+)$/.exec(targetId);
  return match ? Number.parseInt(match[1], 10) : 99;
}

function feedbackMappingNote(
  targetId: string,
  formVariant: "standard" | "week1" | "week12",
  lessonLabel: string
): string {
  if (formVariant === "week1") {
    return `Starting-point survey (not session feedback). Notion Course = Beginners Course, Lesson = ${lessonLabel}. Ratings: understanding spoken Punjabi, basic speaking, optional grammar.`;
  }
  if (formVariant === "week12") {
    return `End-of-course survey. Notion Course = Beginners Course, Lesson = ${lessonLabel}. Extra ratings, recommend, video testimonial, optional photo, and booking widget after Yes.`;
  }
  if (targetId === "week-1-session") {
    return `Standard session feedback for week 1. Notion Course = Beginners Course, Lesson = ${lessonLabel}. Three ratings: learning relevance, tutor effectiveness, confidence.`;
  }
  return `Standard session feedback. Notion Course = Beginners Course, Lesson = ${lessonLabel}. Three ratings: learning relevance, tutor effectiveness, confidence.`;
}

export async function loadPublicFormCatalog(): Promise<PublicFormCatalog> {
  const links = await listPublicFormLinks();
  const origin = getPublicAppUrl();

  const quizLinks = links.filter((link) => link.formType === "quiz");
  const feedbackLinks = links.filter((link) => link.formType === "feedback");

  const quizIds = quizLinks.map((link) => link.targetId).filter(isUuid);
  const questionCounts = new Map<string, number>();
  const lessonNumbers = new Map<string, number | null>();

  const { client } = tryCreateServiceRoleClient();
  if (client && quizIds.length > 0) {
    const [{ data: quizzes }, { data: questions }] = await Promise.all([
      client.from("quizzes").select("id, level_number").in("id", quizIds),
      client.from("quiz_questions").select("quiz_id").in("quiz_id", quizIds),
    ]);

    for (const quiz of quizzes ?? []) {
      lessonNumbers.set(quiz.id, quiz.level_number ?? null);
    }
    for (const row of questions ?? []) {
      const quizId = row.quiz_id as string;
      questionCounts.set(quizId, (questionCounts.get(quizId) ?? 0) + 1);
    }
  }

  const quizzes = quizLinks
    .map((link) => ({
      slug: link.slug,
      label: link.label,
      href: `${origin}/p/${link.slug}`,
      quizId: link.targetId,
      questionCount: questionCounts.get(link.targetId) ?? 0,
      lessonNumber: lessonNumbers.get(link.targetId) ?? null,
    }))
    .sort((a, b) => {
      const [ag, ai] = quizSortKey(a.label);
      const [bg, bi] = quizSortKey(b.label);
      return ag - bg || ai - bi || a.label.localeCompare(b.label);
    });

  const feedback = feedbackLinks
    .flatMap((link) => {
      const target = parsePublicFeedbackTarget(link.targetId);
      if (!target) return [];
      const copy = publicFeedbackCopy(target);
      return [
        {
          slug: link.slug,
          label: link.label,
          href: `${origin}/p/${link.slug}`,
          targetId: link.targetId,
          formVariant: target.formVariant,
          lessonLabel: target.lessonLabel,
          studentTitle: copy.title,
          notionCourse: "Beginners Course",
          mappingNote: feedbackMappingNote(
            link.targetId,
            target.formVariant,
            target.lessonLabel
          ),
        } satisfies PublicFormCatalogFeedback,
      ];
    })
    .sort((a, b) => feedbackSortKey(a.targetId) - feedbackSortKey(b.targetId));

  const error =
    quizzes.length === 0 && feedback.length === 0
      ? "No public form links were found. Check that public_form_links is seeded."
      : undefined;

  return { quizzes, feedback, error };
}
