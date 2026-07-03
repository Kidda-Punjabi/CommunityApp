import { GAME_CATALOG, type GameCatalogEntry } from "@/lib/games/catalog";
import type { GameType } from "@/lib/games/types";

export type GamesFilter = "all" | "vocabulary" | "grammar" | "multiplayer";

export const GAMES_FILTERS: { id: GamesFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "grammar", label: "Grammar" },
  { id: "multiplayer", label: "Multiplayer" },
];

export type PlayableGameId = GameType | "group_games" | "battle";

export type MultiplayerHubEntry = {
  id: "group_games" | "battle";
  title: string;
  description: string;
  emoji: string;
  href: string;
  badge: string;
  badgeClassName: string;
};

export const MULTIPLAYER_HUB_ENTRIES: MultiplayerHubEntry[] = [
  {
    id: "group_games",
    title: "Group games",
    description: "Host or join a room — Buzz-in, Jeopardy, Chado Pauri, and more",
    emoji: "👥",
    href: "/dashboard/group-games",
    badge: "Live classroom",
    badgeClassName: "text-violet-600",
  },
  {
    id: "battle",
    title: "Battle a Friend",
    description: "Live 1v1 — race to answer the same question and deal damage",
    emoji: "⚡",
    href: "/dashboard/battle",
    badge: "Real-time",
    badgeClassName: "text-rose-600",
  },
];

export const DEFAULT_PLAY_AGAIN_GAME: GameType = "lane_runner";

export const INITIAL_GRID_VISIBLE = 4;

const SLUG_TO_GAME_TYPE: Record<string, GameType> = {
  match: "match",
  "memory-grid": "memory_grid",
  "speed-translate": "speed_translate",
  "picture-match": "picture_match",
  "streak-survival": "streak_survival",
  "sentence-builder": "sentence_builder",
  "conjugation-challenge": "conjugation_challenge",
  "gender-sort": "gender_sort",
  "voice-practice": "voice_practice",
  "chado-pauri": "chado_pauri",
  "conversation-practice": "conversation_practice",
  "possessive-practice": "possessive_practice",
  "spot-the-mistake": "spot_the_mistake",
  "comprehension-practice": "comprehension_practice",
  "lane-runner": "lane_runner",
};

const RESOURCE_GAME_PATHS = new Set([
  "/dashboard/games/dictionary",
  "/dashboard/games/verb-conjugator",
]);

export function catalogEntryForType(type: GameType): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((entry) => entry.type === type);
}

export type PlayableHubItem = {
  id: PlayableGameId;
  title: string;
  description: string;
  emoji: string;
  href: string;
};

export function playableHubItem(id: PlayableGameId): PlayableHubItem | null {
  if (id === "group_games" || id === "battle") {
    const entry = MULTIPLAYER_HUB_ENTRIES.find((item) => item.id === id);
    if (!entry) return null;
    return {
      id: entry.id,
      title: entry.title,
      description: entry.description,
      emoji: entry.emoji,
      href: entry.href,
    };
  }

  const catalog = catalogEntryForType(id);
  if (!catalog) return null;

  return {
    id: catalog.type,
    title: catalog.title,
    description: catalog.description,
    emoji: catalog.emoji,
    href: catalog.href,
  };
}

export function gameTypeFromGamesPath(pathname: string): GameType | null {
  if (!pathname.startsWith("/dashboard/games/")) return null;
  if (pathname === "/dashboard/games") return null;
  if (RESOURCE_GAME_PATHS.has(pathname) || pathname.startsWith("/dashboard/games/verb-conjugator")) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const slug = segments[2];
  if (!slug) return null;

  return SLUG_TO_GAME_TYPE[slug] ?? null;
}

export function playableIdFromPath(pathname: string): PlayableGameId | null {
  if (pathname === "/dashboard/battle" || pathname.startsWith("/dashboard/battle/")) {
    return "battle";
  }
  if (pathname.startsWith("/dashboard/group-games")) {
    return "group_games";
  }

  return gameTypeFromGamesPath(pathname);
}

export function isPlayableGameId(value: string): value is PlayableGameId {
  if (value === "group_games" || value === "battle") return true;
  return GAME_CATALOG.some((entry) => entry.type === value);
}
