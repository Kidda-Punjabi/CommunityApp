import type { SupabaseClient } from "@supabase/supabase-js";
import type { RootClass, Verb } from "./types";
import { enrichVerbRomanisation, latinRomanised } from "./romanised";

type VerbRow = {
  id: string;
  infinitive: string;
  infinitive_romanised: string | null;
  english: string;
  root: string;
  root_romanised: string | null;
  root_class: RootClass;
  is_irregular: boolean;
  irregular_past_masc_sg: string | null;
  irregular_past_fem_sg: string | null;
  irregular_past_masc_pl: string | null;
  irregular_past_fem_pl: string | null;
  has_tippi_insertion: boolean;
  notes: string | null;
  flashcards: { romanised: string | null } | { romanised: string | null }[] | null;
};

export function mapVerbRow(row: VerbRow): Verb {
  const flashcard = Array.isArray(row.flashcards) ? row.flashcards[0] : row.flashcards;
  const flashcardRomanised = flashcard?.romanised ?? null;

  return enrichVerbRomanisation({
    id: row.id,
    infinitive: row.infinitive,
    infinitiveRomanised: row.infinitive_romanised ?? flashcardRomanised,
    english: row.english,
    root: row.root,
    rootRomanised: row.root_romanised,
    rootClass: row.root_class,
    isIrregular: row.is_irregular,
    irregularPastMascSg: row.irregular_past_masc_sg,
    irregularPastFemSg: row.irregular_past_fem_sg,
    irregularPastMascPl: row.irregular_past_masc_pl,
    irregularPastFemPl: row.irregular_past_fem_pl,
    hasTippiInsertion: row.has_tippi_insertion,
    notes: row.notes,
  });
}

async function attachFlashcardRomanisation(
  supabase: SupabaseClient,
  verbs: Verb[]
): Promise<Verb[]> {
  const missing = verbs.filter((verb) => !latinRomanised(verb.infinitiveRomanised));
  if (!missing.length) return verbs;

  const infinitives = [...new Set(missing.map((verb) => verb.infinitive))];
  const { data, error } = await supabase
    .from("flashcards")
    .select("back_text, romanised")
    .in("back_text", infinitives)
    .not("romanised", "is", null);

  if (error || !data?.length) return verbs;

  const romanisedByInfinitive = new Map<string, string>();
  for (const row of data) {
    const latin = latinRomanised(row.romanised);
    if (latin && !romanisedByInfinitive.has(row.back_text)) {
      romanisedByInfinitive.set(row.back_text, latin);
    }
  }

  if (!romanisedByInfinitive.size) return verbs;

  return verbs.map((verb) => {
    const fromFlashcard = romanisedByInfinitive.get(verb.infinitive);
    if (!fromFlashcard || latinRomanised(verb.infinitiveRomanised)) return verb;
    return enrichVerbRomanisation({
      ...verb,
      infinitiveRomanised: fromFlashcard,
    });
  });
}

export async function loadVerbs(
  supabase: SupabaseClient
): Promise<{ verbs: Verb[]; tableReady: boolean }> {
  const { data, error } = await supabase
    .from("verbs")
    .select(
      "id, infinitive, infinitive_romanised, english, root, root_romanised, root_class, is_irregular, irregular_past_masc_sg, irregular_past_fem_sg, irregular_past_masc_pl, irregular_past_fem_pl, has_tippi_insertion, notes, flashcards:source_flashcard_id ( romanised )"
    )
    .order("english");

  if (error) {
    if (error.message.includes("verbs") || error.code === "42P01") {
      return { verbs: [], tableReady: false };
    }
    throw error;
  }

  const verbs = (data ?? []).map((row) => mapVerbRow(row as VerbRow));
  return {
    verbs: await attachFlashcardRomanisation(supabase, verbs),
    tableReady: true,
  };
}

export async function loadVerbById(
  supabase: SupabaseClient,
  id: string
): Promise<Verb | null> {
  const { data, error } = await supabase
    .from("verbs")
    .select(
      "id, infinitive, infinitive_romanised, english, root, root_romanised, root_class, is_irregular, irregular_past_masc_sg, irregular_past_fem_sg, irregular_past_masc_pl, irregular_past_fem_pl, has_tippi_insertion, notes, flashcards:source_flashcard_id ( romanised )"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapVerbRow(data as VerbRow);
}
