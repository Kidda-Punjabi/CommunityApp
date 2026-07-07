import { GamesCategoryGrid } from "@/components/games/games-category-grid";
import { GamesHorizontalRow } from "@/components/games/games-horizontal-row";
import { GamesPlayAgainCard } from "@/components/games/games-play-again-card";
import { HubLinkTile } from "@/components/games/hub-link-tile";
import type { GameCatalogEntry } from "@/lib/games/catalog";
import { BATTLE_GAME_HUB_ENTRIES, GROUP_GAME_HUB_ENTRIES } from "@/lib/games/hub-config";

type GamesHubProps = {
  vocabularyGames: GameCatalogEntry[];
  grammarGames: GameCatalogEntry[];
  personalBests: Record<string, number>;
};

export function GamesHub({ vocabularyGames, grammarGames, personalBests }: GamesHubProps) {
  return (
    <div className="space-y-6">
      <section>
        <GamesPlayAgainCard />
      </section>

      <GamesCategoryGrid
        title="Vocabulary games"
        games={vocabularyGames}
        personalBests={personalBests}
      />

      <GamesCategoryGrid
        title="Grammar games"
        games={grammarGames}
        personalBests={personalBests}
      />

      <GamesHorizontalRow title="Group games">
        {GROUP_GAME_HUB_ENTRIES.map((entry) => (
          <HubLinkTile
            key={entry.id}
            title={entry.title}
            emoji={entry.emoji}
            href={entry.href}
            lastPlayedId="group_games"
          />
        ))}
      </GamesHorizontalRow>

      <GamesHorizontalRow title="Battle a friend">
        {BATTLE_GAME_HUB_ENTRIES.map((entry) => (
          <HubLinkTile
            key={entry.id}
            title={entry.title}
            emoji={entry.emoji}
            href={entry.href}
            lastPlayedId="battle"
          />
        ))}
      </GamesHorizontalRow>
    </div>
  );
}
