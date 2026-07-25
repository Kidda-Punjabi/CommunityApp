import type { SupabaseClient } from "@supabase/supabase-js";
import type { FlashcardDeckCard } from "@/lib/flashcards/types";

type SetRow = {
  id: string;
  name: string;
  week_number: number | null;
};

function weekFromSetName(name: string): number | null {
  const match = name.match(/^Week\s+(\d+)\b/i);
  if (!match) return null;
  const week = Number(match[1]);
  return Number.isFinite(week) ? week : null;
}

async function findCommunitySet(
  supabase: SupabaseClient,
  weekNumber: number
): Promise<SetRow | null> {
  const { data: byWeek } = await supabase
    .from("flashcard_sets")
    .select("id, name, week_number")
    .eq("course_association", "community")
    .eq("week_number", weekNumber)
    .limit(1)
    .maybeSingle();

  if (byWeek) return byWeek;

  const { data: candidates } = await supabase
    .from("flashcard_sets")
    .select("id, name, week_number")
    .eq("course_association", "community")
    .ilike("name", `Week ${weekNumber} -%`);

  const match =
    (candidates ?? []).find((row) => weekFromSetName(row.name) === weekNumber) ??
    null;

  return match;
}

export async function loadCommunityTopicCards(
  supabase: SupabaseClient,
  weekNumber: number
): Promise<{ deckId: string | null; deckName: string | null; cards: FlashcardDeckCard[] }> {
  const set = await findCommunitySet(supabase, weekNumber);

  if (!set) {
    return { deckId: null, deckName: null, cards: [] };
  }

  const { data: rows } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, romanised, deck_id, deck_name, icon_name")
    .eq("deck_id", set.id)
    .order("created_at", { ascending: true });

  const cards = (rows ?? []).map((row) => ({
    id: row.id,
    front_text: row.front_text,
    back_text: row.back_text,
    romanised: row.romanised?.trim() || null,
    deck_id: row.deck_id,
    deck_name: row.deck_name ?? set.name,
    icon_name: row.icon_name ?? null,
  }));

  return { deckId: set.id, deckName: set.name, cards };
}
