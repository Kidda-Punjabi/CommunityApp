"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { searchVerbs } from "@/lib/conjugation/conjugate";
import type { Verb } from "@/lib/conjugation/types";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";

const DEBOUNCE_MS = 200;

type VerbConjugatorPickerProps = {
  verbs: Verb[];
  tableReady: boolean;
};

export function VerbConjugatorPicker({ verbs, tableReady }: VerbConjugatorPickerProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const results = useMemo(
    () => searchVerbs(verbs, debouncedQuery),
    [verbs, debouncedQuery]
  );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to Games
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
          Verb Conjugator
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick a verb to explore all 15 tense patterns, or try the quiz.
        </p>
      </div>

      {!tableReady ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The verbs table is not set up yet. Run <code className="text-xs">supabase/verbs.sql</code>{" "}
          in Supabase.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="block flex-1">
              <span className="sr-only">Search verbs</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search to play, khedna, ਖੇਡਣਾ…"
                autoComplete="off"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-base text-zinc-900 shadow-sm outline-none ring-violet-500 placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2"
              />
            </label>
            <Link
              href="/dashboard/games/verb-conjugator/quiz"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 py-3.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
            >
              Quiz mode
            </Link>
          </div>

          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {results.length} verb{results.length === 1 ? "" : "s"}
          </p>

          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {results.map((verb) => (
              <li key={verb.id}>
                <Link
                  href={`/dashboard/games/verb-conjugator/${verb.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{verb.english}</p>
                    <p className="mt-0.5 text-lg text-zinc-800">{verb.infinitive}</p>
                    {verb.infinitiveRomanised && (
                      <p className="text-sm text-violet-600">{verb.infinitiveRomanised}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm text-zinc-400" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {results.length === 0 && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
              <p className="font-medium text-zinc-700">No verbs found</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
