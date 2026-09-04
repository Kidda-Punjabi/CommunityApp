/** Tutors shown on public Beginners feedback links (Notion Tutor select). */
export const PUBLIC_FEEDBACK_TUTOR_OPTIONS = [
  "Arshdeep Kaur",
  "Jasleen Kaur",
  "Tarnjot Kaur",
  "Mankeerat Kaur",
  "Gurupma Singh",
] as const;

export type PublicFeedbackTutor = (typeof PUBLIC_FEEDBACK_TUTOR_OPTIONS)[number];

export function isPublicFeedbackTutor(value: string): value is PublicFeedbackTutor {
  return (PUBLIC_FEEDBACK_TUTOR_OPTIONS as readonly string[]).includes(value);
}

/**
 * Live Notion Cohort options as of seed time, plus common later values.
 * Public pages also try to refresh from the Notion API at request time.
 */
export const PUBLIC_FEEDBACK_COHORT_FALLBACK = [
  "N/A",
  "1-1",
  "1-1 Class",
  "Foundational Course",
  "Community",
  "Refresher course",
  "Cohort 6",
  "Cohort 8",
  "Cohort 9",
  "Cohort 10",
  "Cohort 11",
  "Cohort 12",
  "Cohort 13",
  "Cohort 14",
  "Cohort 15",
  "Cohort 18",
  "Cohort 19",
  "Cohort 20",
  "Cohort 21",
  "Cohort 22",
  "cohort 23",
  "Cohort 24",
  "Cohort 25",
  "Cohort 26",
  "Cohort 27",
  "Cohort 28",
  "Cohort 29",
  "Cohort 30",
  "Cohort 31",
  "Cohort 32",
  "Cohort 34",
  "Cohort 35",
  "Cohort 36",
  "Cohort 37",
  "Cohort 38",
  "Cohort 39",
  "Cohort 40",
  "Cohort 41",
  "Cohort 42",
  "Cohort 43",
] as const;
