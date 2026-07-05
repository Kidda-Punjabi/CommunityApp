import { DictionaryAudioPlayButton } from "@/components/resources/dictionary-audio-play-button";
import type { DictionaryEntry } from "@/lib/resources/dictionary";
import { formatPunjabiForDisplay } from "@/lib/conjugation/format";

export function dictionaryEntryHasExample(entry: DictionaryEntry): boolean {
  return Boolean(
    entry.exampleGurmukhi?.trim() ||
      entry.exampleRomanised?.trim() ||
      entry.exampleEnglish?.trim()
  );
}

export function DictionaryWordHeader({ entry }: { entry: DictionaryEntry }) {
  return (
    <div>
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
      <p className="mt-3 text-3xl text-zinc-900">{formatPunjabiForDisplay(entry.punjabi)}</p>
      {entry.romanised ? (
        <p className="mt-2 text-lg font-medium text-violet-600">{entry.romanised}</p>
      ) : null}
    </div>
  );
}

export function DictionaryPronunciationSection({ entry }: { entry: DictionaryEntry }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Pronunciation
          </p>
          <p className="mt-1 text-sm text-zinc-600">Listen to this word in Punjabi.</p>
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
          Audio is being prepared and will appear here once reviewed and approved.
        </p>
      ) : null}
    </div>
  );
}

export function DictionaryExampleSection({ entry }: { entry: DictionaryEntry }) {
  if (!dictionaryEntryHasExample(entry)) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
        <p className="text-sm text-zinc-500">No example sentence for this word yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Example sentence
          </p>
          <p className="mt-1 text-sm text-zinc-600">See how this word is used in context.</p>
        </div>
        {entry.exampleAudioUrl ? (
          <DictionaryAudioPlayButton
            audioUrl={entry.exampleAudioUrl}
            label={`Play example sentence for ${entry.english}`}
          />
        ) : null}
      </div>

      {entry.exampleGurmukhi ? (
        <p className="mt-4 text-xl text-zinc-900">
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
        <p className="mt-4 text-sm text-amber-800">
          Example audio will be available here once it has been reviewed and approved.
        </p>
      ) : null}
    </div>
  );
}
