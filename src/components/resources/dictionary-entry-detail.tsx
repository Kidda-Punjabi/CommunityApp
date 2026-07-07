import { BackLink } from "@/components/navigation/back-link";
import {
  DictionaryEntryCard,
  DictionaryRelatedWords,
} from "@/components/resources/dictionary-entry-sections";
import type { DictionaryEntry } from "@/lib/resources/dictionary";

type DictionaryEntryDetailProps = {
  entry: DictionaryEntry;
  relatedEntries: DictionaryEntry[];
};

export function DictionaryEntryDetail({ entry, relatedEntries }: DictionaryEntryDetailProps) {
  return (
    <div className="space-y-6">
      <BackLink
        fallbackHref="/dashboard/games/dictionary"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back
      </BackLink>

      <DictionaryEntryCard entry={entry} />
      <DictionaryRelatedWords relatedEntries={relatedEntries} />
    </div>
  );
}
