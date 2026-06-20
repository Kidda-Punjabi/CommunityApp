"use client";

import { useMemo, useState } from "react";
import { DeckSelectList } from "@/components/games/deck-select-list";
import {
  GAME_COURSE_LEVELS,
  type GameCourseLevel,
  decksForCourseLevel,
} from "@/lib/games/course-levels";
import type { GameDeckSummary } from "@/lib/games/load-game-decks";

type GameDeckCoursePickerProps = {
  gameSlug: string;
  gameTitle: string;
  decks: GameDeckSummary[];
};

export function GameDeckCoursePicker({
  gameSlug,
  gameTitle,
  decks,
}: GameDeckCoursePickerProps) {
  const availableLevels = useMemo(
    () =>
      GAME_COURSE_LEVELS.filter((level) =>
        decks.some((deck) => deck.courseTier === level.tier)
      ),
    [decks]
  );

  const [level, setLevel] = useState<GameCourseLevel>(
    availableLevels[0]?.id ?? "foundational"
  );

  const filteredDecks = useMemo(
    () => decksForCourseLevel(decks, level),
    [decks, level]
  );

  if (decks.length === 0) {
    return <DeckSelectList gameSlug={gameSlug} gameTitle={gameTitle} decks={[]} />;
  }

  return (
    <div className="space-y-6">
      {availableLevels.length > 1 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Course level
          </p>
          <div className="flex flex-wrap gap-2">
            {availableLevels.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLevel(option.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  level === option.id
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <DeckSelectList gameSlug={gameSlug} gameTitle={gameTitle} decks={filteredDecks} />
    </div>
  );
}
