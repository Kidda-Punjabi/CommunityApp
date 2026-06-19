import type { SupabaseClient } from "@supabase/supabase-js";
import type { Gender } from "./types";
import type { SentenceNoun } from "./sentence-builder";

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
    romanised: row.romanised?.trim() || null,
  };
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

  return {
    nouns: (data ?? []).map((row) => mapGenderedNounRow(row as NounRow)),
    tableReady: true,
  };
}
