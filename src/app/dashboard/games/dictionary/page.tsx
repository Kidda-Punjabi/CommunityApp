import { DictionarySearch } from "@/components/resources/dictionary-search";
import { loadMasterVocabularyDictionary } from "@/lib/resources/load-master-vocabulary";
import { createClient } from "@/lib/supabase/server";

export default async function DictionaryPage() {
  const supabase = await createClient();
  const { entries, deckFound, rawRowCount } = await loadMasterVocabularyDictionary(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <DictionarySearch entries={entries} deckFound={deckFound} rawRowCount={rawRowCount} />
    </div>
  );
}
