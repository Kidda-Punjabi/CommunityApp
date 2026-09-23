import {
  WEEK1_STARTING_POINT_LESSON_LABEL,
  type FeedbackFormVariant,
} from "@/lib/feedback/constants";
import type { FeedbackCourseName } from "@/lib/feedback/types";
import { KIDS_BEGINNERS_COURSE_NAME } from "@/lib/learning/kids-beginners";

export const KIDS_L1_WEEK_2_FEEDBACK_TARGET_ID = "kids-l1-week-2";
export const KIDS_L1_WEEK_2_LESSON_LABEL = "Family - Week 2";

/** Weeks other than Week 2. Week 2 stays on its own constants above. */
const KIDS_L1_FEEDBACK_WEEKS: ReadonlyArray<{ week: number; lessonLabel: string }> = [
  { week: 1, lessonLabel: "Greetings & Introductions - Week 1" },
  { week: 3, lessonLabel: "Basic Needs - Week 3" },
  { week: 4, lessonLabel: "Numbers - Week 4" },
  { week: 5, lessonLabel: "Colours - Week 5" },
  { week: 6, lessonLabel: "Food - Week 6" },
  { week: 7, lessonLabel: "Ability - Week 7" },
  { week: 8, lessonLabel: "Hobbies - Week 8" },
  { week: 9, lessonLabel: "Routine - Week 9" },
  { week: 10, lessonLabel: "Imperatives and Position - Week 10" },
  { week: 11, lessonLabel: "Recap - Week 11" },
  { week: 12, lessonLabel: "Conversation - Week 12" },
];

export type PublicFeedbackTarget = {
  targetId: string;
  formVariant: Extract<FeedbackFormVariant, "standard" | "week1" | "week12">;
  lessonNumber: number;
  lessonLabel: string;
  course: FeedbackCourseName;
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

function kidsL1FeedbackTarget(week: number, lessonLabel: string): PublicFeedbackTarget {
  return {
    targetId: `kids-l1-week-${week}`,
    formVariant: "standard",
    lessonNumber: week,
    lessonLabel,
    course: KIDS_BEGINNERS_COURSE_NAME,
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
  if (target.course === KIDS_BEGINNERS_COURSE_NAME) {
    return {
      kicker: "Session feedback",
      title: `${target.lessonLabel} feedback`,
      intro: "How was this Kids Beginners Course lesson for you?",
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
    return {
      targetId,
      formVariant: "week1",
      lessonNumber: 1,
      lessonLabel: WEEK1_STARTING_POINT_LESSON_LABEL,
      course: "Beginners Course",
    };
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

  if (targetId === KIDS_L1_WEEK_2_FEEDBACK_TARGET_ID) {
    return {
      targetId,
      formVariant: "standard",
      lessonNumber: 2,
      lessonLabel: KIDS_L1_WEEK_2_LESSON_LABEL,
      course: KIDS_BEGINNERS_COURSE_NAME,
    };
  }

  const kidsWeek = /^kids-l1-week-(\d+)$/.exec(targetId);
  if (kidsWeek) {
    const week = Number.parseInt(kidsWeek[1], 10);
    const entry = KIDS_L1_FEEDBACK_WEEKS.find((row) => row.week === week);
    if (!entry) return null;
    return kidsL1FeedbackTarget(entry.week, entry.lessonLabel);
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
