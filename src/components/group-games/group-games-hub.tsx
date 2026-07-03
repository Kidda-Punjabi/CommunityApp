"use client";

import { useActionState } from "react";
import {
  createGameRoom,
  joinGameRoomByCode,
  type GroupGameActionResult,
} from "@/app/dashboard/group-games/actions";
import {
  DEFAULT_QUESTION_COUNT,
  GROUP_GAME_LABELS,
  GROUP_GAME_TYPES,
} from "@/lib/game-rooms/constants";
import { ui } from "@/lib/ui/styles";

const initial: GroupGameActionResult = {};

type GroupGamesHubProps = {
  initialJoinCode?: string;
};

export function GroupGamesHub({ initialJoinCode = "" }: GroupGamesHubProps) {
  const [createState, createAction, createPending] = useActionState(createGameRoom, initial);
  const [joinState, joinAction, joinPending] = useActionState(joinGameRoomByCode, initial);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Group games</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Host a live classroom game or join with a code. Everyone waits in the lobby until the host
          starts.
        </p>
      </div>

      <section className={`${ui.card} space-y-5`}>
        <div>
          <h2 className="font-heading text-lg font-semibold text-zinc-900">Host a game</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pick a game type, create a room, and share the 6-character code with your class.
          </p>
        </div>

        <form action={createAction} className="space-y-4">
          <fieldset className="space-y-3">
            <legend className="sr-only">Pick a game</legend>
            {GROUP_GAME_TYPES.map((gameType) => (
              <label
                key={gameType}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200/60 px-4 py-3"
              >
                <input
                  type="radio"
                  name="game_type"
                  value={gameType}
                  defaultChecked={gameType === "buzz_in"}
                  className="h-4 w-4 accent-violet-600"
                />
                <span className="font-medium text-zinc-900">{GROUP_GAME_LABELS[gameType]}</span>
              </label>
            ))}
          </fieldset>

          <div>
            <label htmlFor="question_count" className="mb-2 block text-sm font-semibold text-zinc-700">
              Number of questions
            </label>
            <input
              id="question_count"
              name="question_count"
              type="number"
              min={1}
              max={50}
              defaultValue={DEFAULT_QUESTION_COUNT}
              className={ui.input}
            />
          </div>

          {createState.error ? <p className="text-sm text-rose-600">{createState.error}</p> : null}

          <button type="submit" disabled={createPending} className={ui.btnPrimaryBlock}>
            {createPending ? "Creating…" : "Create room & get code"}
          </button>
        </form>
      </section>

      <div className="relative flex items-center gap-4">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">or</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <section className={`${ui.card} space-y-5`}>
        <div>
          <h2 className="font-heading text-lg font-semibold text-zinc-900">Join a game</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Enter the code your host shared to join their lobby.
          </p>
        </div>

        <form action={joinAction} className="space-y-4">
          <div>
            <label htmlFor="join_code" className="mb-2 block text-sm font-semibold text-zinc-700">
              Room code
            </label>
            <input
              id="join_code"
              name="join_code"
              type="text"
              defaultValue={initialJoinCode}
              placeholder="ABC123"
              autoComplete="off"
              maxLength={6}
              className={`${ui.input} text-center font-mono text-lg uppercase tracking-[0.25em]`}
            />
          </div>

          {joinState.error ? <p className="text-sm text-rose-600">{joinState.error}</p> : null}

          <button type="submit" disabled={joinPending} className={ui.btnPrimaryBlock}>
            {joinPending ? "Joining…" : "Join room"}
          </button>
        </form>
      </section>
    </div>
  );
}
