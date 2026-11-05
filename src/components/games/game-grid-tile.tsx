"use client";

import type { GameCatalogEntry } from "@/lib/games/catalog";
import { GAME_LIST_TILE_CLASS, GameListTileBody } from "@/components/games/game-list-tile-body";
import { GAMES_PREMIUM_UNLOCK_URL } from "@/lib/games/premium-gating";
import { NATIVE_GAME_LOCKED_MESSAGE } from "@/lib/native/copy";
import { useNativeApp } from "@/lib/native/native-app-context";
import { recordLastPlayedGame } from "@/lib/games/last-played";
import Link from "next/link";

type GameGridTileProps = {
  game: GameCatalogEntry;
  personalBest: number | null;
  locked?: boolean;
};

export function GameGridTile({ game, personalBest, locked = false }: GameGridTileProps) {
  const nativeApp = useNativeApp();
  if (locked) {
    const body = (
      <GameListTileBody
        emoji={game.emoji}
        title={game.title}
        lockedLabel={nativeApp ? NATIVE_GAME_LOCKED_MESSAGE : "Unlock with Premium"}
      />
    );
    if (nativeApp) return <div className={GAME_LIST_TILE_CLASS}>{body}</div>;
    return (
      <Link href={GAMES_PREMIUM_UNLOCK_URL} className={GAME_LIST_TILE_CLASS}>
        {body}
      </Link>
    );
  }

  return (
    <Link href={game.href} onClick={() => recordLastPlayedGame(game.type)} className={GAME_LIST_TILE_CLASS}>
      <GameListTileBody emoji={game.emoji} title={game.title} personalBest={personalBest} />
    </Link>
  );
}
