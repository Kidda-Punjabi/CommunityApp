import type { SupabaseClient } from "@supabase/supabase-js";
import type { RootClass, Verb } from "./types";

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
};

export function mapVerbRow(row: VerbRow): Verb {
  return {
    id: row.id,
    infinitive: row.infinitive,
    infinitiveRomanised: row.infinitive_romanised,
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
  };
}

export async function loadVerbs(
  supabase: SupabaseClient
): Promise<{ verbs: Verb[]; tableReady: boolean }> {
  const { data, error } = await supabase
    .from("verbs")
    .select(
      "id, infinitive, infinitive_romanised, english, root, root_romanised, root_class, is_irregular, irregular_past_masc_sg, irregular_past_fem_sg, irregular_past_masc_pl, irregular_past_fem_pl, has_tippi_insertion, notes"
    )
    .order("english");

  if (error) {
    if (error.message.includes("verbs") || error.code === "42P01") {
      return { verbs: [], tableReady: false };
    }
    throw error;
  }

  return {
    verbs: (data ?? []).map((row) => mapVerbRow(row as VerbRow)),
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
      "id, infinitive, infinitive_romanised, english, root, root_romanised, root_class, is_irregular, irregular_past_masc_sg, irregular_past_fem_sg, irregular_past_masc_pl, irregular_past_fem_pl, has_tippi_insertion, notes"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapVerbRow(data as VerbRow);
}
