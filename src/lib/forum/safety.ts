export const FORUM_LANGUAGE_MESSAGE =
  "Your post contains language that isn't allowed in the Kidda Community. Please edit it and try again.";

export const FORUM_SUSPENDED_MESSAGE =
  "You can't post in the Community right now. Contact us at kidda.app/contact if you think this is a mistake.";

export const FORUM_REPORT_THANKS =
  "Thanks, our team will review this within 24 hours.";

export const FORUM_REPORT_REASONS = [
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment" },
  { id: "hate_speech", label: "Hate speech" },
  { id: "inappropriate", label: "Inappropriate" },
  { id: "other", label: "Other" },
] as const;

export type ForumReportReason = (typeof FORUM_REPORT_REASONS)[number]["id"];

export const FORUM_RULES_VERSION_KEY = "rules_version";

export const FORUM_RULES = [
  "Be kind and respectful. We are all here to learn.",
  "No bullying, harassment, hate speech or discrimination of any kind.",
  "No offensive, sexual or violent content.",
  "No spam, advertising or self-promotion.",
  "Keep personal details (phone numbers, addresses) private.",
  "Kidda has zero tolerance for abusive content or users. Posts that break these rules will be removed, and accounts that break them may be suspended or removed.",
  'You can report any post or block any user from the "..." menu.',
] as const;

export function forumLanguageError(message: string | undefined): boolean {
  return (message ?? "").includes("FORUM_LANGUAGE_NOT_ALLOWED");
}

export function forumRulesRequiredMessage(message: string | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  return text.includes("row-level security") || text.includes("forum_can_contribute");
}
