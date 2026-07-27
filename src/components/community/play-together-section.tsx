"use client";

import { useActionState } from "react";
import Link from "next/link";
import { quickMatchBattle, type BattleActionResult } from "@/app/dashboard/battle/actions";
import { HubCard } from "@/components/ui/hub-primitives";
import { pressableClass } from "@/lib/ui/pressable";

const initial: BattleActionResult = {};

const tileClass =
  "flex min-h-[5.25rem] flex-col justify-between rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/40";

export function PlayTogetherSection() {
  const [state, formAction, pending] = useActionState(quickMatchBattle, initial);

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-zinc-900">Play together</h2>
      <HubCard className="py-4">
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dashboard/challenges/new" className={tileClass}>
            <span className="text-xl" aria-hidden="true">
              ⚔️
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Challenge a friend</p>
              <p className="mt-0.5 text-xs text-zinc-500">Pick a friend and game</p>
            </div>
          </Link>

          <form action={formAction} className="contents">
            <input type="hidden" name="game_source" value="gender_sort" />
            <button
              type="submit"
              disabled={pending}
              className={`${tileClass} ${pressableClass} disabled:opacity-60`}
            >
              <span className="text-xl" aria-hidden="true">
                ⚡
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  {pending ? "Finding match…" : "Quick match"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">Live duel or play the computer</p>
              </div>
            </button>
          </form>
        </div>

        {state.error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
      </HubCard>
    </section>
  );
}
