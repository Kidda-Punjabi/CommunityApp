import type { GameCatalogEntry } from "@/lib/games/catalog";
import { GAME_CATALOG } from "@/lib/games/catalog";
import type { GameType } from "@/lib/games/types";
import { PREMIUM_UNLOCK_PATH } from "@/lib/products/premium-checkout";

/**
 * PLACEHOLDER — free tier unlocks the first N games in GAME_CATALOG order.
 * Confirm exact count/list with Gurupma before treating as final product policy.
 */
export const FREE_GAME_UNLOCK_COUNT = 4;

export const GAMES_PREMIUM_UNLOCK_URL = PREMIUM_UNLOCK_PATH;

export function gameDisplayOrder(type: GameType): number {
  const index = GAME_CATALOG.findIndex((entry) => entry.type === type);
  return index >= 0 ? index + 1 : Number.MAX_SAFE_INTEGER;
}

export function isGameUnlockedForTier(
  type: GameType,
  isPremium: boolean
): boolean {
  if (isPremium) return true;
  return gameDisplayOrder(type) <= FREE_GAME_UNLOCK_COUNT;
}

export function partitionGamesByPremiumAccess(
  games: GameCatalogEntry[],
  isPremium: boolean
): { unlocked: GameCatalogEntry[]; locked: GameCatalogEntry[] } {
  const unlocked: GameCatalogEntry[] = [];
  const locked: GameCatalogEntry[] = [];
  for (const game of games) {
    if (isGameUnlockedForTier(game.type, isPremium)) unlocked.push(game);
    else locked.push(game);
  }
  return { unlocked, locked };
}
