import type { SupabaseClient } from "@supabase/supabase-js";
import type { Gender } from "./types";
import { latinRomanised } from "./romanised";

export type SentenceNoun = {
  id: string;
  punjabi: string;
  english: string;
  gender: Gender;
  romanised: string | null;
};

type NounRow = {
  id: string;
  punjabi_word: string;
  english_meaning: string;
  gender: Gender;
  romanised: string | null;
};

export function mapGenderedNounRow(row: NounRow): SentenceNoun {
  return {
    id: row.id,
    punjabi: row.punjabi_word,
    english: row.english_meaning,
    gender: row.gender,
    romanised: latinRomanised(row.romanised),
  };
}

async function attachNounFlashcardRomanisation(
  supabase: SupabaseClient,
  nouns: SentenceNoun[]
): Promise<SentenceNoun[]> {
  const missing = nouns.filter((noun) => !latinRomanised(noun.romanised));
  if (!missing.length) return nouns;

  const words = [...new Set(missing.map((noun) => noun.punjabi))];
  const { data, error } = await supabase
    .from("flashcards")
    .select("back_text, romanised")
    .in("back_text", words)
    .not("romanised", "is", null);

  if (error || !data?.length) return nouns;

  const romanisedByWord = new Map<string, string>();
  for (const row of data) {
    const latin = latinRomanised(row.romanised);
    if (latin && !romanisedByWord.has(row.back_text)) {
      romanisedByWord.set(row.back_text, latin);
    }
  }

  if (!romanisedByWord.size) return nouns;

  return nouns.map((noun) => {
    const fromFlashcard = romanisedByWord.get(noun.punjabi);
    if (!fromFlashcard || latinRomanised(noun.romanised)) return noun;
    return { ...noun, romanised: fromFlashcard };
  });
}

export async function loadGenderedNouns(
  supabase: SupabaseClient
): Promise<{ nouns: SentenceNoun[]; tableReady: boolean }> {
  const { data, error } = await supabase
    .from("gendered_nouns")
    .select("id, punjabi_word, english_meaning, gender, romanised")
    .order("english_meaning");

  if (error) {
    if (error.message.includes("gendered_nouns") || error.code === "42P01") {
      return { nouns: [], tableReady: false };
    }
    throw error;
  }

  const nouns = (data ?? []).map((row) => mapGenderedNounRow(row as NounRow));
  return {
    nouns: await attachNounFlashcardRomanisation(supabase, nouns),
    tableReady: true,
  };
}
