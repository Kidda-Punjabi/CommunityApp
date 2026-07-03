import { PossessivePracticeMode } from "@/components/games/possessive-practice-mode";
import { loadPossessivePracticeContent } from "@/lib/possessive-practice/load-possessive-practice";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";

export default async function PossessivePracticePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await getCourseAccessContext(supabase, user!);
  const content = await loadPossessivePracticeContent(supabase, access.unlockedCourseIds);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <PossessivePracticeMode {...content} />
    </div>
  );
}
