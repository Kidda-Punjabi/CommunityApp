import { BackLink } from "@/components/navigation/back-link";
import {
  DictionaryExampleSection,
  DictionaryPronunciationSection,
  DictionaryWordHeader,
} from "@/components/resources/dictionary-entry-sections";
import type { DictionaryEntry } from "@/lib/resources/dictionary";

type DictionaryEntryDetailProps = {
  entry: DictionaryEntry;
};

export function DictionaryEntryDetail({ entry }: DictionaryEntryDetailProps) {
  return (
    <div className="space-y-6">
      <BackLink fallbackHref="/dashboard/games/dictionary" className="text-sm font-medium text-violet-600 hover:text-violet-500">
        ← Back to Dictionary
      </BackLink>

      <DictionaryWordHeader entry={entry} />
      <DictionaryPronunciationSection entry={entry} />
      <DictionaryExampleSection entry={entry} />
    </div>
  );
}
