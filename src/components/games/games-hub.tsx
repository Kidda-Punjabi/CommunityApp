"use client";

import { useState } from "react";
import { GamesCategoryGrid } from "@/components/games/games-category-grid";
import { GamesFilterChips } from "@/components/games/games-filter-chips";
import { GamesPlayAgainCard } from "@/components/games/games-play-again-card";
import { GamesResourceRows } from "@/components/games/games-resource-rows";
import { MultiplayerGridTile } from "@/components/games/multiplayer-grid-tile";
import type { GameCatalogEntry } from "@/lib/games/catalog";
import { MULTIPLAYER_HUB_ENTRIES, type GamesFilter } from "@/lib/games/hub-config";
import { ui } from "@/lib/ui/styles";

type GamesHubProps = {
  vocabularyGames: GameCatalogEntry[];
  grammarGames: GameCatalogEntry[];
  personalBests: Record<string, number>;
};

function showSection(filter: GamesFilter, section: GamesFilter): boolean {
  return filter === "all" || filter === section;
}

export function GamesHub({ vocabularyGames, grammarGames, personalBests }: GamesHubProps) {
  const [activeFilter, setActiveFilter] = useState<GamesFilter>("all");

  return (
    <div className="space-y-8">
      <GamesFilterChips active={activeFilter} onChange={setActiveFilter} />

      <section>
        <GamesPlayAgainCard />
      </section>

      {showSection(activeFilter, "multiplayer") ? (
        <section>
          <h2 className={ui.sectionTitle}>Multiplayer</h2>
          <div className="grid grid-cols-2 gap-3">
            {MULTIPLAYER_HUB_ENTRIES.map((entry) => (
              <MultiplayerGridTile
                key={entry.id}
                entry={entry}
                personalBest={null}
              />
            ))}
          </div>
        </section>
      ) : null}

      {showSection(activeFilter, "vocabulary") ? (
        <GamesCategoryGrid
          title="Vocabulary games"
          games={vocabularyGames}
          personalBests={personalBests}
          categoryLabel="vocabulary"
        />
      ) : null}

      {showSection(activeFilter, "grammar") ? (
        <GamesCategoryGrid
          title="Grammar games"
          games={grammarGames}
          personalBests={personalBests}
          categoryLabel="grammar"
        />
      ) : null}

      {showSection(activeFilter, "resources") ? <GamesResourceRows /> : null}
    </div>
  );
}
