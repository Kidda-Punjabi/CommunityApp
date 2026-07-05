import { DictionaryEntryDetail } from "@/components/resources/dictionary-entry-detail";
import { loadDictionaryEntryById } from "@/lib/resources/load-master-vocabulary";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type DictionaryEntryPageProps = {
  params: Promise<{ entryId: string }>;
};

export default async function DictionaryEntryPage({ params }: DictionaryEntryPageProps) {
  const { entryId } = await params;
  const supabase = await createClient();
  const entry = await loadDictionaryEntryById(supabase, entryId);

  if (!entry) notFound();

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <DictionaryEntryDetail entry={entry} />
    </div>
  );
}
