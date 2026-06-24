"use client";

import { useActionState } from "react";
import {
  createBattleSession,
  joinBattleByCode,
  type BattleActionResult,
} from "@/app/dashboard/battle/actions";
import { BATTLE_GAME_SOURCES } from "@/lib/battle/constants";
import { ui } from "@/lib/ui/styles";

const GAME_LABELS: Record<(typeof BATTLE_GAME_SOURCES)[number], string> = {
  gender_sort: "Gender Sort",
  conjugation_challenge: "Conjugation Challenge",
};

const initial: BattleActionResult = {};

type BattleLobbyHubProps = {
  initialJoinCode?: string;
};

export function BattleLobbyHub({ initialJoinCode = "" }: BattleLobbyHubProps) {
  const [createState, createAction, createPending] = useActionState(createBattleSession, initial);
  const [joinState, joinAction, joinPending] = useActionState(joinBattleByCode, initial);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Battle a Friend</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Live 1v1 — both players answer the same question at the same time. One person hosts and
          shares a code; the other joins with that code.
        </p>
      </div>

      <section className={`${ui.card} space-y-5`}>
        <div>
          <h2 className="font-heading text-lg font-semibold text-zinc-900">Host a battle</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pick a game, create a room, and share the 6-character code with your friend.
          </p>
        </div>

        <form action={createAction} className="space-y-4">
          <fieldset className="space-y-3">
            <legend className="sr-only">Pick a game</legend>
            {BATTLE_GAME_SOURCES.map((source) => (
              <label
                key={source}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200/60 px-4 py-3`}
              >
                <input
                  type="radio"
                  name="game_source"
                  value={source}
                  defaultChecked={source === "gender_sort"}
                  className="h-4 w-4 accent-violet-600"
                />
                <span className="font-medium text-zinc-900">{GAME_LABELS[source]}</span>
              </label>
            ))}
          </fieldset>

          {createState.error ? <p className="text-sm text-rose-600">{createState.error}</p> : null}

          <button type="submit" disabled={createPending} className={ui.btnPrimaryBlock}>
            {createPending ? "Creating…" : "Create battle & get code"}
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
          <h2 className="font-heading text-lg font-semibold text-zinc-900">Join a battle</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Your friend already created a battle? Enter their code below to join.
          </p>
        </div>

        <form action={joinAction} className="space-y-4">
          <div>
            <label htmlFor="invite_code" className="mb-2 block text-sm font-semibold text-zinc-700">
              Battle code
            </label>
            <input
              id="invite_code"
              name="invite_code"
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
            {joinPending ? "Joining…" : "Join battle"}
          </button>
        </form>
      </section>
    </div>
  );
}
