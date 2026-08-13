export const HELP_CONTACT_EMAIL = "hello@kidda.app";

export function helpQuestionMailtoHref(subject = "Question from the Kidda app"): string {
  return `mailto:${HELP_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
