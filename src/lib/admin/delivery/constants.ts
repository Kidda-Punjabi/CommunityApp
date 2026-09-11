export const DELIVERY_TUTORS = [
  "Arshdeep Kaur",
  "Tarnjot Kaur",
  "Jasleen Kaur",
  "Navjit Kaur",
  "Gurupma Singh",
  "Mankeerat Kaur",
] as const;

export type DeliveryTutorName = (typeof DELIVERY_TUTORS)[number];

export const DELIVERY_CLASS_TYPES = [
  { id: "beginner_group", label: "Beginner Group" },
  { id: "one_to_one", label: "1-1" },
  { id: "foundational", label: "Foundational" },
  { id: "refresher", label: "Refresher" },
  { id: "community", label: "Community" },
] as const;

export type DeliveryClassTypeId = (typeof DELIVERY_CLASS_TYPES)[number]["id"];

export const DELIVERY_RANGE_PRESETS = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
] as const;

export type DeliveryRangeId = (typeof DELIVERY_RANGE_PRESETS)[number]["id"] | "custom";

/** Default "below par" bar for Overall Score (1–5). Flagged for approval. */
export const BELOW_PAR_OVERALL_SCORE = 3.5;

export const ACTIONED_STATUSES = [
  "Not started",
  "Need to Message",
  "Pending",
  "Messaged",
  "No response",
  "Tutor has been informed",
  "Need to Ascend",
  "Free Session Given",
  "None Required",
  "Done",
] as const;

export type ActionedStatus = (typeof ACTIONED_STATUSES)[number];

export const VIDEO_TESTIMONIAL_RECORDED_STATUSES = [
  "N/A",
  "Need to Message",
  "Waiting for Response",
  "Need to Send Agreement",
  "Waiting for Agreement",
  "Time Booked",
  "Needs Editing",
  "Live on Website",
  "Changed their mind",
] as const;

export type VideoTestimonialRecordedStatus =
  (typeof VIDEO_TESTIMONIAL_RECORDED_STATUSES)[number];

export const VIDEO_TESTIMONIAL_RECORDED_DONE = [
  "Time Booked",
  "Live on Website",
  "Needs Editing",
  "Changed their mind",
] as const;

export const KIDDA_CLASS_TITLE_NEEDLE = "Kidda Class";

export const TUTOR_PROFILE_MATCHERS: Array<{
  notionName: DeliveryTutorName;
  pattern: RegExp;
}> = [
  { notionName: "Arshdeep Kaur", pattern: /arshdeep/i },
  { notionName: "Tarnjot Kaur", pattern: /tarnjot|\btarn\b/i },
  { notionName: "Jasleen Kaur", pattern: /jasleen/i },
  { notionName: "Navjit Kaur", pattern: /navjit/i },
  { notionName: "Gurupma Singh", pattern: /gurupma/i },
  { notionName: "Mankeerat Kaur", pattern: /mankeerat/i },
];
