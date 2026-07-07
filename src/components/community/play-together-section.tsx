"use client";

import { useActionState } from "react";
import Link from "next/link";
import { quickMatchBattle, type BattleActionResult } from "@/app/dashboard/battle/actions";
import { ui } from "@/lib/ui/styles";

const initial: BattleActionResult = {};

export function PlayTogetherSection() {
  const [state, formAction, pending] = useActionState(quickMatchBattle, initial);

  return (
    <section>
      <h2 className="mb-4 text-lg font-medium text-zinc-900">Play together</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/dashboard/challenges/new"
          className={`${ui.cardBordered} flex min-h-[7.5rem] flex-col justify-between transition-colors hover:border-violet-200 hover:bg-violet-50/40`}
        >
          <span className="text-2xl" aria-hidden="true">
            ⚔️
          </span>
          <div>
            <p className="font-semibold text-zinc-900">Challenge a friend</p>
            <p className="mt-1 text-xs text-zinc-500">Pick a friend and game</p>
          </div>
        </Link>

        <form action={formAction} className="contents">
          <input type="hidden" name="game_source" value="gender_sort" />
          <button
            type="submit"
            disabled={pending}
            className={`${ui.cardBordered} flex min-h-[7.5rem] flex-col justify-between text-left transition-colors hover:border-violet-200 hover:bg-violet-50/40 disabled:opacity-60`}
          >
            <span className="text-2xl" aria-hidden="true">
              ⚡
            </span>
            <div>
              <p className="font-semibold text-zinc-900">
                {pending ? "Finding match…" : "Quick match"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Live duel or play the computer</p>
            </div>
          </button>
        </form>
      </div>

      {state.error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
