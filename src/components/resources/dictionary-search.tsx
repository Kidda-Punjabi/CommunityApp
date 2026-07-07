"use client";

import { BackLink } from "@/components/navigation/back-link";
import { dictionaryEntryHasExample } from "@/components/resources/dictionary-entry-sections";
import { ui } from "@/lib/ui/styles";
import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  countDictionaryExploreCategories,
  DICTIONARY_EXPLORE_CATEGORIES,
  filterDictionaryByExploreCategory,
  searchDictionaryEntries,
  type DictionaryEntry,
} from "@/lib/resources/dictionary";
import { DictionaryExploreCategories } from "@/components/resources/dictionary-explore-categories";
import { formatPunjabiForDisplay } from "@/lib/conjugation/format";

const DEBOUNCE_MS = 200;

type DictionarySearchProps = {
  entries: DictionaryEntry[];
  deckFound: boolean;
  rawRowCount?: number;
};

function dictionaryEntryHref(entryId: string): string {
  return `/dashboard/games/dictionary/${entryId}`;
}

function DictionaryResultRow({ entry }: { entry: DictionaryEntry }) {
  const hasExample = dictionaryEntryHasExample(entry);

  return (
    <li>
      <Link
        href={dictionaryEntryHref(entry.id)}
        className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-violet-50/60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-zinc-900">{entry.english}</p>
            {entry.gender ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-600">
                {entry.gender}
              </span>
            ) : null}
            {entry.isPlural ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                plural
              </span>
            ) : null}
            {entry.wordAudioUrl ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                audio
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-lg text-zinc-900">{formatPunjabiForDisplay(entry.punjabi)}</p>
          {entry.romanised ? (
            <p className="mt-0.5 text-sm font-medium text-violet-600">{entry.romanised}</p>
          ) : null}
          {hasExample ? (
            <p className="mt-1 text-xs text-zinc-500">Tap to see example sentence</p>
          ) : null}
        </div>
        <span className="shrink-0 text-lg text-zinc-300" aria-hidden="true">
          ›
        </span>
      </Link>
    </li>
  );
}

export function DictionarySearch({ entries, deckFound, rawRowCount }: DictionarySearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      setActiveCategoryId(null);
    }
  }, [debouncedQuery]);

  const results = useMemo(
    () => searchDictionaryEntries(entries, debouncedQuery),
    [entries, debouncedQuery]
  );

  const categoryCounts = useMemo(
    () => countDictionaryExploreCategories(entries),
    [entries]
  );

  const activeCategory = useMemo(
    () => DICTIONARY_EXPLORE_CATEGORIES.find((category) => category.id === activeCategoryId),
    [activeCategoryId]
  );

  const categoryEntries = useMemo(
    () =>
      activeCategoryId ? filterDictionaryByExploreCategory(entries, activeCategoryId) : [],
    [entries, activeCategoryId]
  );

  const trimmed = debouncedQuery.trim();
  const showEmpty = trimmed.length > 0 && results.length === 0;
  const wordCount = entries.length;
  const showDeckDetail =
    deckFound && rawRowCount !== undefined && rawRowCount > wordCount;
  const showExplore = deckFound && !trimmed && !activeCategoryId;
  const showCategoryBrowse = deckFound && !trimmed && activeCategoryId && activeCategory;

  return (
    <div className="space-y-5">
      <BackLink className="text-sm font-medium text-violet-600 hover:text-violet-500">
        ← Back
      </BackLink>

      <div className="flex items-start gap-3.5">
        <div
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600"
          aria-hidden="true"
        >
          <BookOpen className="h-6 w-6" strokeWidth={2} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-zinc-900">
            Punjabi dictionary
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {wordCount} word{wordCount === 1 ? "" : "s"}, ready whenever you need them
          </p>
        </div>
      </div>

      {!deckFound ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The master vocabulary deck is not set up yet. Add a flashcard set named
          &ldquo;Vocabulary - Master List&rdquo; in admin.
        </div>
      ) : (
        <div className={ui.stack}>
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

          {showDeckDetail ? (
            <p className="text-center text-xs text-zinc-400">
              {rawRowCount} cards in the master deck
            </p>
          ) : null}

          {showExplore ? (
            <DictionaryExploreCategories
              counts={categoryCounts}
              onSelect={setActiveCategoryId}
            />
          ) : null}

          {showCategoryBrowse ? (
            <div>
              <button
                type="button"
                onClick={() => setActiveCategoryId(null)}
                className="text-sm font-medium text-violet-600 hover:text-violet-500"
              >
                ← All topics
              </button>
              <div className="mt-3">
                <h2 className="font-heading text-lg font-semibold text-zinc-900">
                  {activeCategory.label}
                </h2>
                <p className="mt-0.5 text-sm text-zinc-500">{activeCategory.description}</p>
              </div>
              <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-zinc-400">
                {categoryEntries.length} word{categoryEntries.length === 1 ? "" : "s"}
              </p>
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {categoryEntries.map((entry) => (
                  <DictionaryResultRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </div>
          ) : null}

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
        </div>
      )}
    </div>
  );
}
