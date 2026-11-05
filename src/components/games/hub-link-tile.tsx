"use client";

import { GAME_LIST_TILE_CLASS, GameListTileBody } from "@/components/games/game-list-tile-body";
import type { PlayableGameId } from "@/lib/games/hub-config";
import { recordLastPlayedGame } from "@/lib/games/last-played";
import Link from "next/link";

type HubLinkTileProps = {
  title: string;
  emoji: string;
  href: string;
  personalBest?: number | null;
  lastPlayedId?: PlayableGameId;
};

export function HubLinkTile({ title, emoji, href, personalBest = null, lastPlayedId }: HubLinkTileProps) {
  return (
    <Link
      href={href}
      onClick={() => {
        if (lastPlayedId) recordLastPlayedGame(lastPlayedId);
      }}
      className={GAME_LIST_TILE_CLASS}
    >
      <GameListTileBody emoji={emoji} title={title} personalBest={personalBest} />
    </Link>
  );
}
