import { ConversationPracticeMode } from "@/components/conversation/conversation-practice-mode";
import { loadConversationPracticeContent } from "@/lib/conversation/load-conversation-content";
import { createClient } from "@/lib/supabase/server";

export default async function ConversationPracticePage() {
  const supabase = await createClient();
  const content = await loadConversationPracticeContent(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <ConversationPracticeMode {...content} />
    </div>
  );
}
