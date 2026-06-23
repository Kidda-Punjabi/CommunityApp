"use client";

import { useActionState } from "react";
import { createBattleSession, type BattleActionResult } from "@/app/dashboard/battle/actions";
import { BATTLE_GAME_SOURCES } from "@/lib/battle/constants";
import { ui } from "@/lib/ui/styles";

const GAME_LABELS: Record<(typeof BATTLE_GAME_SOURCES)[number], string> = {
  gender_sort: "Gender Sort",
  conjugation_challenge: "Conjugation Challenge",
};

const initial: BattleActionResult = {};

export function BattleCreateForm() {
  const [state, action, pending] = useActionState(createBattleSession, initial);

  return (
    <form action={action} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Battle a Friend</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Live 1v1 — both players answer the same question at the same time. Damage is based on
          speed and accuracy.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-zinc-700">Pick a game</legend>
        {BATTLE_GAME_SOURCES.map((source) => (
          <label
            key={source}
            className={`flex cursor-pointer items-center gap-3 ${ui.cardBordered}`}
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

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}

      <button type="submit" disabled={pending} className={ui.btnPrimaryBlock}>
        {pending ? "Creating battle…" : "Create battle & get invite code"}
      </button>
    </form>
  );
}
