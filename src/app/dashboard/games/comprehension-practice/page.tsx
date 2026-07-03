import { ComprehensionPracticeMode } from "@/components/comprehension/comprehension-practice-mode";
import { loadComprehensionPracticeContent } from "@/lib/comprehension/load-comprehension-content";
import { createClient } from "@/lib/supabase/server";

export default async function ComprehensionPracticePage() {
  const supabase = await createClient();
  const content = await loadComprehensionPracticeContent(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <ComprehensionPracticeMode {...content} />
    </div>
  );
}
