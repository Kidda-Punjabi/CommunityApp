"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  searchDictionaryEntries,
  type DictionaryEntry,
} from "@/lib/resources/dictionary";
import { formatPunjabiForDisplay } from "@/lib/conjugation/format";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";

const DEBOUNCE_MS = 200;

type DictionarySearchProps = {
  entries: DictionaryEntry[];
  deckFound: boolean;
};

function DictionaryResultRow({ entry }: { entry: DictionaryEntry }) {
  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-zinc-900">{entry.english}</p>
        <div className="flex flex-wrap gap-1.5">
          {entry.gender && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-600">
              {entry.gender}
            </span>
          )}
          {entry.isPlural && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
              plural
            </span>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xl text-zinc-900">{formatPunjabiForDisplay(entry.punjabi)}</p>
      {entry.romanised && (
        <p className="mt-1 text-sm font-medium text-violet-600">{entry.romanised}</p>
      )}
    </li>
  );
}

export function DictionarySearch({ entries, deckFound }: DictionarySearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const results = useMemo(
    () => searchDictionaryEntries(entries, debouncedQuery),
    [entries, debouncedQuery]
  );

  const trimmed = debouncedQuery.trim();
  const showEmpty = trimmed.length > 0 && results.length === 0;
  const showPrompt = trimmed.length === 0;

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
          Punjabi Dictionary
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Search by English, Gurmukhi, or romanised pronunciation.
        </p>
      </div>

      {!deckFound ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The master vocabulary deck is not set up yet. Add a flashcard set named
          &ldquo;Vocabulary - Master List&rdquo; in admin.
        </div>
      ) : (
        <>
          <label className="block">
            <span className="sr-only">Search dictionary</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try chair, kursi, ਕੁਰਸੀ…"
              autoComplete="off"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-base text-zinc-900 shadow-sm outline-none ring-violet-500 placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2"
            />
          </label>

          {showPrompt && (
            <p className="text-center text-sm text-zinc-500">
              {entries.length} words in the master list. Start typing to search.
            </p>
          )}

          {showEmpty && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
              <p className="font-medium text-zinc-700">No matches found</p>
              <p className="mt-1 text-sm text-zinc-500">
                Try a different spelling or partial word.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                {results.length} result{results.length === 1 ? "" : "s"}
              </p>
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {results.map((entry) => (
                  <DictionaryResultRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
