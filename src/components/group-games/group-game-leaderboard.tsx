"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { resetGameRoomToLobby } from "@/app/dashboard/group-games/actions";
import type { ScoreboardEntry } from "@/components/group-games/group-game-scoreboard";
import { GROUP_GAME_LABELS, GROUP_GAME_TYPES } from "@/lib/game-rooms/constants";
import type { GroupGameType } from "@/lib/game-rooms/types";
import { ui } from "@/lib/ui/styles";

type GroupGameLeaderboardProps = {
  title: string;
  subtitle?: string;
  entries: ScoreboardEntry[];
  currentUserId: string;
  roomId?: string;
  isHost?: boolean;
  currentGameType?: GroupGameType;
};

export function GroupGameLeaderboard({
  title,
  subtitle = "Final scores",
  entries,
  currentUserId,
  roomId,
  isHost = false,
  currentGameType,
}: GroupGameLeaderboardProps) {
  const router = useRouter();
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [changingGame, setChangingGame] = useState(false);
  const [nextGameType, setNextGameType] = useState<GroupGameType>(
    currentGameType ?? "buzz_in"
  );

  function playAgain(sameType: boolean) {
    if (!roomId) return;
    setError(null);
    startTransition(async () => {
      const result = await resetGameRoomToLobby({
        roomId,
        gameType: sameType ? currentGameType : nextGameType,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/group-games/room/${roomId}`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">{title}</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">{subtitle}</h1>
      </div>

      <ol className={`${ui.card} divide-y divide-zinc-100`}>
        {sorted.map((entry, index) => (
          <li key={entry.userId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="w-6 text-center text-sm font-bold text-zinc-400">{index + 1}</span>
            <span className="min-w-0 flex-1 font-medium text-zinc-900">
              {entry.displayName}
              {entry.userId === currentUserId ? " (you)" : ""}
            </span>
            <span className="font-semibold text-violet-600">{entry.score}</span>
          </li>
        ))}
      </ol>

      {isHost && roomId ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => playAgain(true)}
            className={ui.btnPrimaryBlock}
          >
            {pending ? "Returning to lobby…" : "Play again (same room)"}
          </button>

          {changingGame ? (
            <div className={`${ui.card} space-y-3`}>
              <p className="text-sm font-semibold text-zinc-800">Switch game in this room</p>
              <fieldset className="space-y-2">
                {GROUP_GAME_TYPES.map((gameType) => (
                  <label key={gameType} className="flex items-center gap-2 text-sm text-zinc-800">
                    <input
                      type="radio"
                      name="next_game_type"
                      checked={nextGameType === gameType}
                      onChange={() => setNextGameType(gameType)}
                      className="h-4 w-4 accent-violet-600"
                    />
                    {GROUP_GAME_LABELS[gameType]}
                  </label>
                ))}
              </fieldset>
              <button
                type="button"
                disabled={pending}
                onClick={() => playAgain(false)}
                className={ui.btnPrimaryBlock}
              >
                {pending ? "Updating…" : "Switch & return to lobby"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setChangingGame(false)}
                className={`${ui.btnSecondary} w-full justify-center`}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setChangingGame(true)}
              className={`${ui.btnSecondary} w-full justify-center`}
            >
              Change game (keep room code)
            </button>
          )}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <p className="text-center text-xs text-zinc-500">
            Same join code — players already in the room stay; others can rejoin from the lobby.
          </p>
        </div>
      ) : roomId ? (
        <p className="text-center text-sm text-zinc-500">
          Waiting for the host to start another round in this room…
        </p>
      ) : null}

      <Link href="/dashboard/group-games" className={`${ui.btnSecondary} w-full justify-center`}>
        Back to group games
      </Link>
    </div>
  );
}
