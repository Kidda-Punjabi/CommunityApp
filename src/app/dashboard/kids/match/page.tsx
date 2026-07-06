import { KidMatchClient } from "@/components/kids/kid-match-client";
import { buildKidDeckContext } from "@/lib/kids/build-kid-deck";
import { loadKidFriendlyFlashcards } from "@/lib/kids/load-kid-content";
import { loadKidSession } from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function KidMatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session = await loadKidSession(user.id);
  const kid = session.activeKidProfile;
  if (!kid || kid.age_tier !== "early_reader") redirect("/dashboard/kids");

  const cards = await loadKidFriendlyFlashcards(supabase, 8);
  const deck = buildKidDeckContext(cards, "Kids memory match");

  return <KidMatchClient deck={deck} />;
}
