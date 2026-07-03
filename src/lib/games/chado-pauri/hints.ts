import type { ChadoPauriQuestion } from "./types";

const CATEGORY_HINTS: Record<string, string> = {
  alphabet: "This card is from the alphabet — think about letters and sounds.",
  vocab: "This is a vocabulary word — consider everyday meanings.",
  sentences: "This is a short sentence or phrase — read the prompt carefully.",
};

function formatTopicTag(tag: string): string {
  return tag
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Hint that adds context without revealing the correct answer text. */
export function buildTutorHint(question: ChadoPauriQuestion): string {
  const parts: string[] = [];

  if (question.category && CATEGORY_HINTS[question.category]) {
    parts.push(CATEGORY_HINTS[question.category]);
  } else if (question.category) {
    parts.push(`Category: ${formatTopicTag(question.category)}.`);
  }

  if (question.topic_tags.length > 0) {
    const topics = question.topic_tags.slice(0, 2).map(formatTopicTag).join(", ");
    parts.push(`Related topics: ${topics}.`);
  }

  if (parts.length === 0) {
    return "Rule out answers that don't fit the prompt — the correct choice matches the front of the card.";
  }

  return parts.join(" ");
}
