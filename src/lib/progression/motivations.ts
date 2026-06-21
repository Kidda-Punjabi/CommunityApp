export const GOAL_MOTIVATIONS = [
  { id: "talk_to_family", label: "Talk to family and relatives" },
  { id: "travel_to_punjab", label: "Travel to Punjab" },
  { id: "music_and_films", label: "Understand Punjabi music and films" },
  { id: "heritage", label: "Reconnect with my heritage" },
  { id: "other_curious", label: "Other / just curious" },
] as const;

export type GoalMotivationId = (typeof GOAL_MOTIVATIONS)[number]["id"];

export function getMotivationLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return GOAL_MOTIVATIONS.find((entry) => entry.id === id)?.label ?? id;
}

export function isGoalMotivationId(id: string): id is GoalMotivationId {
  return GOAL_MOTIVATIONS.some((entry) => entry.id === id);
}

export function parseMotivationIds(stored: string | null | undefined): GoalMotivationId[] {
  if (!stored?.trim()) return [];
  return stored
    .split(",")
    .map((part) => part.trim())
    .filter(isGoalMotivationId);
}

export function serializeMotivationIds(ids: Iterable<string>): string {
  return [...ids].join(",");
}

export function getMotivationLabels(stored: string | null | undefined): string[] {
  return parseMotivationIds(stored)
    .map((id) => getMotivationLabel(id))
    .filter((label): label is string => Boolean(label));
}

/** Human-readable list for profile UI, e.g. "Talk to family and Heritage". */
export function formatMotivationLabels(stored: string | null | undefined): string | null {
  const labels = getMotivationLabels(stored);
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
