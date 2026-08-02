import { GamesCategoryGrid } from "@/components/games/games-category-grid";
import { GamesHorizontalRow } from "@/components/games/games-horizontal-row";
import { GamesPlayAgainCard } from "@/components/games/games-play-again-card";
import { HubLinkTile } from "@/components/games/hub-link-tile";
import type { GameCatalogEntry } from "@/lib/games/catalog";
import { BATTLE_GAME_HUB_ENTRIES, GROUP_GAME_HUB_ENTRIES } from "@/lib/games/hub-config";
import { isGameUnlockedForTier } from "@/lib/games/premium-gating";

type GamesHubProps = {
  vocabularyGames: GameCatalogEntry[];
  grammarGames: GameCatalogEntry[];
  personalBests: Record<string, number>;
  isPremium?: boolean;
  hideGrammar?: boolean;
};

export function GamesHub({
  vocabularyGames,
  grammarGames,
  personalBests,
  isPremium = false,
  hideGrammar = false,
}: GamesHubProps) {
  return (
    <div className="space-y-6">
      <section>
        <GamesPlayAgainCard />
      </section>

      <GamesCategoryGrid
        title="Vocabulary games"
        games={vocabularyGames}
        personalBests={personalBests}
        isPremium={isPremium}
      />

      {!hideGrammar && grammarGames.length > 0 ? (
        <GamesCategoryGrid
          title="Grammar games"
          games={grammarGames}
          personalBests={personalBests}
          isPremium={isPremium}
        />
      ) : null}

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

export function gameLockedForHub(
  type: GameCatalogEntry["type"],
  isPremium: boolean
): boolean {
  return !isGameUnlockedForTier(type, isPremium);
}
