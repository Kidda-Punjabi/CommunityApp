import type { PaidCourseTier } from "@/lib/membership/access";
import type { GameDeckSummary } from "./load-game-decks";

export type GameCourseLevel = "foundational" | "beginners" | "community";

export const GAME_COURSE_LEVELS: { id: GameCourseLevel; label: string; tier: PaidCourseTier }[] = [
  { id: "foundational", label: "Foundational", tier: "foundational" },
  { id: "beginners", label: "Beginner", tier: "beginners" },
  { id: "community", label: "Community", tier: "community" },
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

export type GameDeckPickerLevel = {
  id: string;
  label: string;
};

function courseLevelLabel(courseName: string): string {
  if (/kids/i.test(courseName)) return "Kids";
  return courseName;
}

/** Standard levels, plus one pill per course that is not Foundational, Beginner, or Community. */
export function gameDeckPickerLevels(decks: GameDeckSummary[]): GameDeckPickerLevel[] {
  const standard = GAME_COURSE_LEVELS.filter((level) =>
    decks.some((deck) => deck.courseTier === level.tier)
  );
  const extraNames = [
    ...new Set(
      decks
        .filter((deck) => !standard.some((level) => deck.courseTier === level.tier))
        .map((deck) => deck.courseName)
    ),
  ];

  return [
    ...extraNames.map((name) => ({ id: `course:${name}`, label: courseLevelLabel(name) })),
    ...standard.map((level) => ({ id: level.id, label: level.label })),
  ];
}

export function decksForPickerLevel(
  decks: GameDeckSummary[],
  levelId: string
): GameDeckSummary[] {
  if (levelId.startsWith("course:")) {
    const courseName = levelId.slice("course:".length);
    return decks.filter((deck) => deck.courseName === courseName);
  }

  const level = GAME_COURSE_LEVELS.find((item) => item.id === levelId);
  if (!level) return decks;
  const filtered = filterDecksByCourseLevel(decks, level.id);
  return filtered.length > 0 ? filtered : decks;
}
