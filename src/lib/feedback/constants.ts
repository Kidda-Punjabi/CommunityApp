export const NOTION_COURSE_OPTIONS = [
  "Foundational Course",
  "Beginners Course",
  "Community",
] as const;

export type NotionCourseOption = (typeof NOTION_COURSE_OPTIONS)[number];

export const NOTION_TUTOR_OPTIONS = [
  "Adnan Arsalani",
  "Jasleen Kaur",
  "Gurupma Singh",
  "Arshdeep Kaur",
  "Mankeerat Kaur",
  "Tarnjot Kaur",
] as const;

export const FUTURE_SUPPORT_OPTIONS = [
  "Speaking more confidently",
  "Listening and understanding fast Punjabi",
  "Grammar and sentence structure",
  "Expanding vocabulary",
  "Pronunciation",
  "Using Punjabi in real-life situations",
  "Other",
] as const;

export type FutureSupportOption = (typeof FUTURE_SUPPORT_OPTIONS)[number];

/** Shown on every lesson feedback form (lessons 1–11, foundational, community, etc.). */
export const STANDARD_RATING_FIELDS = [
  { key: "learningRelevance", label: "Learning relevance" },
  { key: "tutorEffectiveness", label: "Tutor effectiveness" },
  { key: "confidence", label: "Confidence" },
] as const;

/** Additional ratings only on Beginners Course lesson 12 (end-of-course survey). */
export const WEEK12_EXTRA_RATING_FIELDS = [
  { key: "understanding", label: "Understanding" },
  { key: "speaking", label: "Speaking" },
  { key: "understandingGrammar", label: "Understanding grammar" },
  { key: "clarityStructure", label: "Clarity & structure" },
  { key: "conceptBreakdown", label: "Concept breakdown" },
  { key: "supportiveness", label: "Supportiveness" },
  { key: "overallScore", label: "Overall score" },
] as const;

export type StandardRatingFieldKey = (typeof STANDARD_RATING_FIELDS)[number]["key"];
export type Week12ExtraRatingFieldKey = (typeof WEEK12_EXTRA_RATING_FIELDS)[number]["key"];
export type RatingFieldKey = StandardRatingFieldKey | Week12ExtraRatingFieldKey;

export type FeedbackFormVariant = "standard" | "week12";

export function isWeek12FeedbackForm(
  course: NotionCourseOption,
  lessonNumber: number | null | undefined
): boolean {
  return course === "Beginners Course" && lessonNumber === 12;
}
