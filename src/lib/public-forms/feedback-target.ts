import type { FeedbackFormVariant, NotionCourseOption } from "@/lib/feedback/constants";

export type PublicFeedbackTarget = {
  targetId: string;
  formVariant: Extract<FeedbackFormVariant, "standard" | "week1" | "week12">;
  lessonNumber: number;
  lessonLabel: string;
  course: NotionCourseOption;
};

function beginnersTarget(
  targetId: string,
  formVariant: PublicFeedbackTarget["formVariant"],
  lessonNumber: number
): PublicFeedbackTarget {
  return {
    targetId,
    formVariant,
    lessonNumber,
    lessonLabel: `Lesson ${lessonNumber}`,
    course: "Beginners Course",
  };
}

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
  if (target.course === "Foundational Course") {
    return {
      kicker: "Session feedback",
      title: `Foundational lesson ${target.lessonNumber} feedback`,
      intro: "How was this Foundational Course lesson for you?",
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
    return beginnersTarget(targetId, "standard", 1);
  }
  if (targetId === "week-1-starting-point") {
    return beginnersTarget(targetId, "week1", 1);
  }

  const foundational = /^foundational-week-(\d+)$/.exec(targetId);
  if (foundational) {
    const lessonNumber = Number.parseInt(foundational[1], 10);
    if (lessonNumber < 1 || lessonNumber > 4) return null;
    return {
      targetId,
      formVariant: "standard",
      lessonNumber,
      lessonLabel: `Lesson ${lessonNumber}`,
      course: "Foundational Course",
    };
  }

  const match = /^week-(\d+)$/.exec(targetId);
  if (!match) return null;
  const lessonNumber = Number.parseInt(match[1], 10);
  if (lessonNumber < 2 || lessonNumber > 12) return null;

  return beginnersTarget(
    targetId,
    lessonNumber === 12 ? "week12" : "standard",
    lessonNumber
  );
}
