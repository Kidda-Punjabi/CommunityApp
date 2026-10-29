"use client";

import { backToRooms, bringBack, startGroupGame, stopGroupGame } from "@/app/admin/community/breakout-actions";
import { GROUP_GAME_LABELS } from "@/lib/game-rooms/constants";
import type { GroupGameType } from "@/lib/game-rooms/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

const GAMES: GroupGameType[] = ["point_race", "buzz_in", "jeopardy", "sentence_builder_group"];

type Result = { error?: string; href?: string } | { ok: true; href?: string } | { error: string } | undefined;

/** Wrap up, while the session is live: bring everyone back, then optionally one game for the whole group. */
export function HostMainRoom({
  occurrenceId,
  inMainRoom,
  groupGame,
  hadRooms,
}: {
  occurrenceId: string;
  inMainRoom: boolean;
  groupGame: { gameRoomId: string; joinCode: string; gameType: string } | null;
  hadRooms: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<Result>, open = false) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    if (open && result && "href" in result && result.href) window.open(result.href, "_blank", "noopener");
    router.refresh();
  }

  if (!inMainRoom) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-6">
        <p className="font-heading text-lg font-extrabold">1 · Bring everyone back</p>
        <p className="text-sm text-zinc-600">
          Tap this, then close the breakout rooms in Meet. Everyone&apos;s phone switches to the main-room screen.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => bringBack(occurrenceId))}
          className="min-h-12 w-fit rounded-2xl bg-violet-600 px-6 text-base font-bold text-white disabled:opacity-50"
        >
          Bring everyone back
        </button>
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-heading text-lg font-extrabold">2 · Whole group (optional)</p>
          <p className="text-sm text-zinc-600">
            Everyone is back in the main room. Run freestyle questions on the call, or start one game for everyone on this week&apos;s topic.
          </p>
        </div>
        {hadRooms ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => backToRooms(occurrenceId))}
            className="min-h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700"
          >
            Back to breakout rooms
          </button>
        ) : null}
      </div>

      {groupGame ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-700 px-5 py-4 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-violet-200">Group game running</p>
            <p className="font-heading text-2xl font-extrabold">
              {GROUP_GAME_LABELS[groupGame.gameType as GroupGameType] ?? "Game"} · code {groupGame.joinCode}
            </p>
            <p className="text-sm text-violet-100">Every phone shows a Join button with this code.</p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/dashboard/group-games/room/${groupGame.gameRoomId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-extrabold text-violet-800"
            >
              Open game
            </a>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => stopGroupGame(occurrenceId))}
              className="min-h-11 rounded-xl border border-white/50 px-4 text-sm font-bold text-white"
            >
              Finish game
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-4">
          {GAMES.map((game) => (
            <button
              key={game}
              type="button"
              disabled={pending}
              onClick={() => run(() => startGroupGame(occurrenceId, game), true)}
              className="min-h-14 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-[15px] font-bold text-zinc-900 hover:bg-violet-50 disabled:opacity-50"
            >
              {GROUP_GAME_LABELS[game]}
            </button>
          ))}
        </div>
      )}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </section>
  );
}
