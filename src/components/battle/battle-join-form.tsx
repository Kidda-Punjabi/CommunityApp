"use client";

import { useActionState } from "react";
import { joinBattleByCode, type BattleActionResult } from "@/app/dashboard/battle/actions";
import { ui } from "@/lib/ui/styles";

const initial: BattleActionResult = {};

type BattleJoinFormProps = {
  initialCode?: string;
};

export function BattleJoinForm({ initialCode = "" }: BattleJoinFormProps) {
  const [state, action, pending] = useActionState(joinBattleByCode, initial);

  return (
    <form action={action} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Join a Battle</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter the code your friend shared to join their live battle.
        </p>
      </div>

      <div>
        <label htmlFor="invite_code" className="mb-2 block text-sm font-semibold text-zinc-700">
          Battle code
        </label>
        <input
          id="invite_code"
          name="invite_code"
          type="text"
          defaultValue={initialCode}
          placeholder="ABC123"
          autoComplete="off"
          className={`${ui.input} uppercase tracking-widest`}
        />
      </div>

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}

      <button type="submit" disabled={pending} className={ui.btnPrimaryBlock}>
        {pending ? "Joining…" : "Join battle"}
      </button>
    </form>
  );
}
