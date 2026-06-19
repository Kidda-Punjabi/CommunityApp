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
