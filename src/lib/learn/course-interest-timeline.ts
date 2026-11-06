/** When someone who registered interest would like to start. Shared by the pop-up, API and emails. */
export const COURSE_INTEREST_TIMELINES = [
  { value: "straight_away", label: "Straight away" },
  { value: "next_2_3_weeks", label: "In the next 2 to 3 weeks" },
  { value: "within_a_month", label: "Within the next month or so" },
  { value: "in_2_3_months", label: "In 2 to 3 months" },
  { value: "sometime_future", label: "Sometime in the future" },
] as const;

export type CourseInterestTimeline = (typeof COURSE_INTEREST_TIMELINES)[number]["value"];

export function isCourseInterestTimeline(value: unknown): value is CourseInterestTimeline {
  return COURSE_INTEREST_TIMELINES.some((option) => option.value === value);
}

export function courseInterestTimelineLabel(value: string | null | undefined): string {
  return COURSE_INTEREST_TIMELINES.find((option) => option.value === value)?.label ?? "Not answered";
}

/** Straight away and the next 2 to 3 weeks are the leads to call first. */
export function isHotCourseInterest(value: string | null | undefined): boolean {
  return value === "straight_away" || value === "next_2_3_weeks";
}
