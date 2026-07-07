import { DictionaryEntryDetail } from "@/components/resources/dictionary-entry-detail";
import { findRelatedDictionaryEntries } from "@/lib/resources/dictionary";
import {
  loadDictionaryEntryById,
  loadMasterVocabularyDictionary,
} from "@/lib/resources/load-master-vocabulary";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type DictionaryEntryPageProps = {
  params: Promise<{ entryId: string }>;
};

export default async function DictionaryEntryPage({ params }: DictionaryEntryPageProps) {
  const { entryId } = await params;
  const supabase = await createClient();

  const [entry, dictionary] = await Promise.all([
    loadDictionaryEntryById(supabase, entryId),
    loadMasterVocabularyDictionary(supabase),
  ]);

  if (!entry) notFound();

  const relatedEntries = findRelatedDictionaryEntries(entry, dictionary.entries);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <DictionaryEntryDetail entry={entry} relatedEntries={relatedEntries} />
    </div>
  );
}
