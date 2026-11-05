import { GAMES_LIST_GRID_CLASS, GamesCategoryGrid } from "@/components/games/games-category-grid";
import { GamesCategoryCards, type GamesCategoryCard } from "@/components/games/games-category-cards";
import { HubLinkTile } from "@/components/games/hub-link-tile";
import type { GameCatalogEntry } from "@/lib/games/catalog";
import { BATTLE_GAME_HUB_ENTRIES, GROUP_GAME_HUB_ENTRIES } from "@/lib/games/hub-config";
import { isGameUnlockedForTier } from "@/lib/games/premium-gating";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type GamesHubProps = {
  vocabularyGames: GameCatalogEntry[];
  grammarGames: GameCatalogEntry[];
  personalBests: Record<string, number>;
  isPremium?: boolean;
  hasFoundationalAccess?: boolean;
  extraVocabularyTiles?: ReactNode;
};

export type GamesCategoryId = GamesCategoryCard["id"];

export function isGamesCategoryId(value: string | undefined): value is GamesCategoryId {
  return value === "vocab" || value === "grammar" || value === "group" || value === "battle";
}

/** The four category cards. Each opens the games it holds. */
export function GamesHub({ hideGrammar = false }: { hideGrammar?: boolean }) {
  const href = (id: GamesCategoryId) => `/dashboard/games?category=${id}`;
  const cards: GamesCategoryCard[] = [
    { id: "vocab", title: "Vocab", href: href("vocab"), wide: false },
    ...(hideGrammar ? [] : [{ id: "grammar", title: "Grammar", href: href("grammar"), wide: false } as GamesCategoryCard]),
    { id: "group", title: "Group", href: href("group"), wide: false },
    { id: "battle", title: "Battle", href: href("battle"), wide: hideGrammar },
  ];
  return <GamesCategoryCards cards={cards} />;
}

/** One category's games, using the same tiles and gating as before. */
export function GamesCategoryList({
  category,
  vocabularyGames,
  grammarGames,
  personalBests,
  isPremium = false,
  hasFoundationalAccess = false,
  extraVocabularyTiles = null,
  note = null,
}: GamesHubProps & { category: GamesCategoryId; note?: string | null }) {
  const titles: Record<GamesCategoryId, string> = { vocab: "Vocab", grammar: "Grammar", group: "Group", battle: "Battle" };
  return (
    <div>
      <div className="mb-3.5 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
        <Link
          href="/dashboard/games"
          aria-label="Back to Games"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-900"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.4} aria-hidden />
        </Link>
        <h1 className="text-center font-heading text-[22px] font-extrabold tracking-tight text-zinc-900">
          {titles[category]}
        </h1>
      </div>
      {note ? <p className="mb-4 text-sm text-zinc-500">{note}</p> : null}
      {category === "vocab" ? (
        <GamesCategoryGrid
          games={vocabularyGames}
          personalBests={personalBests}
          isPremium={isPremium}
          hasFoundationalAccess={hasFoundationalAccess}
          extraTiles={extraVocabularyTiles}
        />
      ) : null}
      {category === "grammar" ? (
        <GamesCategoryGrid
          games={grammarGames}
          personalBests={personalBests}
          isPremium={isPremium}
          hasFoundationalAccess={hasFoundationalAccess}
        />
      ) : null}
      {category === "group" ? (
        <div className={GAMES_LIST_GRID_CLASS}>
          {GROUP_GAME_HUB_ENTRIES.map((entry) => (
            <HubLinkTile key={entry.id} title={entry.title} emoji={entry.emoji} href={entry.href} lastPlayedId="group_games" />
          ))}
        </div>
      ) : null}
      {category === "battle" ? (
        <div className={GAMES_LIST_GRID_CLASS}>
          {BATTLE_GAME_HUB_ENTRIES.map((entry) => (
            <HubLinkTile key={entry.id} title={entry.title} emoji={entry.emoji} href={entry.href} lastPlayedId="battle" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function gameLockedForHub(
  type: GameCatalogEntry["type"],
  isPremium: boolean,
  hasFoundationalAccess = false
): boolean {
  return !isGameUnlockedForTier(type, isPremium, hasFoundationalAccess);
}
