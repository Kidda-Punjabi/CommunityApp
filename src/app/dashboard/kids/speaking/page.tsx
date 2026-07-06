import { KidSpeakingPractice } from "@/components/kids/kid-speaking-practice";
import { loadKidFriendlyFlashcards } from "@/lib/kids/load-kid-content";
import { loadKidSession } from "@/lib/kids/session";
import type { SpeakingPracticeCard } from "@/lib/games/speaking-practice";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function KidSpeakingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session = await loadKidSession(user.id);
  if (!session.activeKidProfile) redirect("/dashboard/profile/kids");

  const rows = await loadKidFriendlyFlashcards(supabase, 6);
  const cards: SpeakingPracticeCard[] = rows.map((row) => ({
    id: row.id,
    english: row.front_text,
    punjabi: row.back_text,
    romanised: row.back_text,
    iconName: row.icon_name ?? null,
    difficulty: 1,
  }));

  return <KidSpeakingPractice cards={cards} />;
}
