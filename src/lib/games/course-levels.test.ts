import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decksForPickerLevel, gameDeckPickerLevels } from "./course-levels";
import type { GameDeckSummary } from "./load-game-decks";

function deck(partial: Partial<GameDeckSummary> & Pick<GameDeckSummary, "courseName" | "courseTier" | "setName">): GameDeckSummary {
  return {
    lessonId: "lesson",
    deckId: partial.setName,
    cardCount: 1,
    weekNumber: 1,
    lessonTitle: "Lesson",
    ...partial,
  };
}

describe("gameDeckPickerLevels", () => {
  it("puts a kids course ahead of free public levels", () => {
    const decks = [
      deck({
        courseName: "Foundational Course",
        courseTier: "foundational",
        setName: "Alphabet",
      }),
      deck({
        courseName: "Kids Beginners Course (Level 1)",
        courseTier: null,
        setName: "Vocabulary - Week 1",
      }),
    ];

    const levels = gameDeckPickerLevels(decks);
    assert.equal(levels[0]?.label, "Kids");
    assert.deepEqual(
      decksForPickerLevel(decks, levels[0]!.id).map((item) => item.setName),
      ["Vocabulary - Week 1"]
    );
  });
});
