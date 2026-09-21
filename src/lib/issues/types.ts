export const ISSUE_AREAS = [
  "login_signup",
  "lessons_classes",
  "homework",
  "billing_payments",
  "games_practice",
  "community",
  "other",
] as const;

export type IssueArea = (typeof ISSUE_AREAS)[number];

export type IssueReportStatus = "open" | "resolved";

export type IssueAttachment = {
  path: string;
  name: string;
  mime_type: string;
  size: number;
};

export const ISSUE_AREA_LABELS: Record<IssueArea, string> = {
  login_signup: "Login or signup",
  lessons_classes: "Lessons and classes",
  homework: "Homework",
  billing_payments: "Billing and payments",
  games_practice: "Games and practice",
  community: "Community",
  other: "Something else",
};

export const ISSUE_ATTACHMENTS_BUCKET = "issue-attachments";

export const ISSUE_DESCRIPTION_MIN = 10;
export const ISSUE_DESCRIPTION_MAX = 4000;
export const ISSUE_MAX_FILES = 5;
export const ISSUE_IMAGE_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const ISSUE_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const ISSUE_RATE_LIMIT_MAX = 10;
export const ISSUE_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const ISSUE_RATE_LIMIT_MESSAGE =
  "You've sent several reports today. Please wait before sending another.";

export const ISSUE_ERROR_FALLBACK = "Something went wrong. Please try again.";

export const ISSUE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type IssueAllowedMime = (typeof ISSUE_ALLOWED_MIME_TYPES)[number];
