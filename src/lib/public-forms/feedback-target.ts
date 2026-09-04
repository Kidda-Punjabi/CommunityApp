import type { FeedbackFormVariant } from "@/lib/feedback/constants";

export type PublicFeedbackTarget = {
  targetId: string;
  formVariant: Extract<FeedbackFormVariant, "standard" | "week1" | "week12">;
  lessonNumber: number;
  lessonLabel: string;
};

export function publicFeedbackCopy(target: PublicFeedbackTarget): {
  kicker: string;
  title: string;
  intro: string;
} {
  if (target.formVariant === "week1") {
    return {
      kicker: "Starting point",
      title: "Week 1 starting point",
      intro: "Tell us how confident you feel at the start of the Beginners Course.",
    };
  }
  if (target.formVariant === "week12") {
    return {
      kicker: "Course feedback",
      title: "Week 12 course feedback",
      intro: "You've finished the Beginners Course — this is our end-of-course survey.",
    };
  }
  return {
    kicker: "Session feedback",
    title: `Lesson ${target.lessonNumber} feedback`,
    intro: "How was this lesson for you?",
  };
}

export function parsePublicFeedbackTarget(targetId: string): PublicFeedbackTarget | null {
  if (targetId === "week-1-session") {
    return {
      targetId,
      formVariant: "standard",
      lessonNumber: 1,
      lessonLabel: "Lesson 1",
    };
  }
  if (targetId === "week-1-starting-point") {
    return {
      targetId,
      formVariant: "week1",
      lessonNumber: 1,
      lessonLabel: "Lesson 1",
    };
  }

  const match = /^week-(\d+)$/.exec(targetId);
  if (!match) return null;
  const lessonNumber = Number.parseInt(match[1], 10);
  if (lessonNumber < 2 || lessonNumber > 12) return null;

  return {
    targetId,
    formVariant: lessonNumber === 12 ? "week12" : "standard",
    lessonNumber,
    lessonLabel: `Lesson ${lessonNumber}`,
  };
}
