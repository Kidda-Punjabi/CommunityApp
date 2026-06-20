import type { PaidCourseTier } from "@/lib/membership/access";
import type { GameDeckSummary } from "./load-game-decks";

export type GameCourseLevel = "foundational" | "beginners";

export const GAME_COURSE_LEVELS: { id: GameCourseLevel; label: string; tier: PaidCourseTier }[] = [
  { id: "foundational", label: "Foundational", tier: "foundational" },
  { id: "beginners", label: "Beginner", tier: "beginners" },
];

export function filterDecksByCourseLevel(
  decks: GameDeckSummary[],
  level: GameCourseLevel
): GameDeckSummary[] {
  return decks.filter((deck) => deck.courseTier === level);
}

export function decksForCourseLevel(
  decks: GameDeckSummary[],
  level: GameCourseLevel
): GameDeckSummary[] {
  const filtered = filterDecksByCourseLevel(decks, level);
  return filtered.length > 0 ? filtered : decks;
}
