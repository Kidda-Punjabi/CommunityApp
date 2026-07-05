import { SpeakingPracticeMode } from "@/components/games/speaking-practice-mode";
import { loadCatchupSegmentSpeakingCards } from "@/lib/catchup/load-segment-speaking";
import { loadSpeakingPracticeContent } from "@/lib/games/load-speaking-practice";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ catchupSegmentId?: string }>;
};

export default async function SpeakingPracticePage({ searchParams }: PageProps) {
  const { catchupSegmentId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let cards;
  let attempts;
  let tableReady;
  let loadError;

  if (catchupSegmentId?.trim()) {
    const segmentCards = await loadCatchupSegmentSpeakingCards(supabase, catchupSegmentId.trim());
    const base = await loadSpeakingPracticeContent(supabase, user.id);
    cards = segmentCards.length > 0 ? segmentCards : base.cards;
    attempts = base.attempts;
    tableReady = base.tableReady;
    loadError =
      segmentCards.length === 0
        ? "This catch-up segment has no speaking phrases configured yet."
        : null;
  } else {
    const base = await loadSpeakingPracticeContent(supabase, user.id);
    cards = base.cards;
    attempts = base.attempts;
    tableReady = base.tableReady;
    loadError = base.loadError;
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <SpeakingPracticeMode
        cards={cards}
        initialAttempts={attempts}
        tableReady={tableReady}
        loadError={loadError}
      />
    </div>
  );
}
