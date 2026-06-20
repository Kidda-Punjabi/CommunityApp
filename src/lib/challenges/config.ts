import { GAME_CATALOG, gameDeckPlayHref, gameSlugForType } from "@/lib/games/catalog";
import type { GameType } from "@/lib/games/types";
import type { ChallengeConfig, StreakSurvivalVariant } from "./types";

export function gameTitleForType(type: GameType): string {
  return GAME_CATALOG.find((game) => game.type === type)?.title ?? type;
}

export function buildChallengeConfig(input: {
  session?: ChallengeConfig["session"];
  deck?: ChallengeConfig["deck"];
  streakVariant?: StreakSurvivalVariant;
}): ChallengeConfig {
  return {
    seed: Math.floor(Math.random() * 2147483646) + 1,
    ...input,
  };
}

export function challengePlayPath(gameType: GameType, config: ChallengeConfig): string {
  if (gameType === "streak_survival") {
    switch (config.streakVariant) {
      case "gender":
        return "/dashboard/games/streak-survival/gender";
      case "verbs":
        return "/dashboard/games/streak-survival/verbs";
      case "deck":
        if (config.deck) {
          return `/dashboard/games/streak-survival/deck/${config.deck.lessonId}/${config.deck.deckId}`;
        }
        return "/dashboard/games/streak-survival/foundational";
      case "foundational":
      default:
        return "/dashboard/games/streak-survival/foundational";
    }
  }

  if (config.deck) {
    return gameDeckPlayHref(gameSlugForType(gameType), config.deck.lessonId, config.deck.deckId);
  }

  const entry = GAME_CATALOG.find((game) => game.type === gameType);
  return entry?.href ?? `/dashboard/games/${gameSlugForType(gameType)}`;
}

export function challengePlayHref(challengeId: string, gameType: GameType, config: ChallengeConfig): string {
  const base = challengePlayPath(gameType, config);
  return `${base}?challenge=${challengeId}`;
}

export function challengeResultHref(challengeId: string): string {
  return `/dashboard/challenges/${challengeId}`;
}

export function scoreLabelForGameType(gameType: GameType): string {
  switch (gameType) {
    case "match":
      return "pairs matched";
    case "memory_grid":
      return "pairs found";
    case "speed_translate":
      return "points";
    case "streak_survival":
      return "streak";
    case "gender_sort":
      return "points";
    default:
      return "correct";
  }
}
