"use client";

import { playableHubItem, type PlayableGameId } from "@/lib/games/hub-config";
import { readLastPlayedGame, recordLastPlayedGame, resolvePlayAgainId } from "@/lib/games/last-played";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useEffect, useState } from "react";

export function GamesPlayAgainCard() {
  const [playAgainId, setPlayAgainId] = useState<PlayableGameId>(() =>
    resolvePlayAgainId(null)
  );

  useEffect(() => {
    setPlayAgainId(resolvePlayAgainId(readLastPlayedGame()));
  }, []);

  const game = playableHubItem(playAgainId);
  if (!game) return null;

  return (
    <Link
      href={game.href}
      onClick={() => recordLastPlayedGame(game.id)}
      className={ui.heroCard}
    >
      <span className={ui.heroBadge}>Play again</span>
      <p className={ui.heroTitle}>{game.title}</p>
      <p className={ui.heroSubtitle}>{game.description}</p>
      <span className={ui.heroCta}>Play</span>
    </Link>
  );
}
