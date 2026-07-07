import { DictionaryAudioPlayButton } from "@/components/resources/dictionary-audio-play-button";
import type { DictionaryEntry } from "@/lib/resources/dictionary";
import { formatPunjabiForDisplay } from "@/lib/conjugation/format";
import Link from "next/link";

export function dictionaryEntryHasExample(entry: DictionaryEntry): boolean {
  return Boolean(
    entry.exampleGurmukhi?.trim() ||
      entry.exampleRomanised?.trim() ||
      entry.exampleEnglish?.trim()
  );
}

function dictionaryEntryHref(entryId: string): string {
  return `/dashboard/games/dictionary/${entryId}`;
}

export function DictionaryEntryCard({ entry }: { entry: DictionaryEntry }) {
  const hasExample = dictionaryEntryHasExample(entry);

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">{entry.english}</h1>
        <div className="flex flex-wrap gap-1.5">
          {entry.gender ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-600">
              {entry.gender}
            </span>
          ) : null}
          {entry.isPlural ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              plural
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl text-zinc-900">{formatPunjabiForDisplay(entry.punjabi)}</p>
          {entry.romanised ? (
            <p className="mt-2 text-lg font-medium text-violet-600">{entry.romanised}</p>
          ) : null}
        </div>
        {entry.wordAudioUrl ? (
          <DictionaryAudioPlayButton
            audioUrl={entry.wordAudioUrl}
            label={`Play pronunciation for ${entry.english}`}
          />
        ) : null}
      </div>

      {!entry.wordAudioUrl ? (
        <p className="mt-3 text-sm text-amber-800">
          Pronunciation audio is being prepared and will appear here once reviewed.
        </p>
      ) : null}

      {hasExample ? (
        <div className="mt-5 border-t border-zinc-100 pt-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Example sentence
            </p>
            {entry.exampleAudioUrl ? (
              <DictionaryAudioPlayButton
                audioUrl={entry.exampleAudioUrl}
                label={`Play example sentence for ${entry.english}`}
                size="sm"
              />
            ) : null}
          </div>

          {entry.exampleGurmukhi ? (
            <p className="mt-3 text-xl text-zinc-900">
              {formatPunjabiForDisplay(entry.exampleGurmukhi)}
            </p>
          ) : null}
          {entry.exampleRomanised ? (
            <p className="mt-2 text-base font-medium text-violet-600">{entry.exampleRomanised}</p>
          ) : null}
          {entry.exampleEnglish ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{entry.exampleEnglish}</p>
          ) : null}

          {!entry.exampleAudioUrl ? (
            <p className="mt-3 text-sm text-amber-800">
              Example audio will appear here once it has been reviewed.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 border-t border-zinc-100 pt-5 text-sm text-zinc-500">
          No example sentence for this word yet.
        </p>
      )}
    </article>
  );
}

export function DictionaryRelatedWords({
  relatedEntries,
}: {
  relatedEntries: DictionaryEntry[];
}) {
  if (relatedEntries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Related words
      </h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        {relatedEntries.map((related) => (
          <Link
            key={related.id}
            href={dictionaryEntryHref(related.id)}
            className="w-[min(72vw,11rem)] shrink-0 snap-start rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-200 hover:bg-violet-50/40"
          >
            <p className="truncate font-medium text-zinc-900">{related.english}</p>
            <p className="mt-2 truncate text-lg text-zinc-800">
              {formatPunjabiForDisplay(related.punjabi)}
            </p>
            {related.romanised ? (
              <p className="mt-1 truncate text-sm font-medium text-violet-600">
                {related.romanised}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
