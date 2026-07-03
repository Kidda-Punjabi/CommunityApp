import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenderedNoun } from "@/lib/games/types";
import { enrichGenderedNounsRomanisation } from "@/lib/games/enrich-gendered-nouns";
import { filterAccessibleGrammarRows } from "@/lib/games/grammar-access";
import type {
  PossessiveForm,
  PossessivePracticeContent,
  Postposition,
} from "./types";

function isMissingTable(message: string, table: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes(table) && lower.includes("does not exist");
}

function normalizePossessiveForm(row: Record<string, unknown>): PossessiveForm {
  return {
    id: String(row.id),
    person_english: String(row.person_english ?? ""),
    masc_sg_gurmukhi: String(row.masc_sg_gurmukhi ?? ""),
    masc_sg_romanised: String(row.masc_sg_romanised ?? ""),
    fem_sg_gurmukhi: String(row.fem_sg_gurmukhi ?? ""),
    fem_sg_romanised: String(row.fem_sg_romanised ?? ""),
    oblique_gurmukhi: String(row.oblique_gurmukhi ?? ""),
    oblique_romanised: String(row.oblique_romanised ?? ""),
    display_order: Number(row.display_order ?? 0),
  };
}

function normalizePostposition(row: Record<string, unknown>): Postposition {
  return {
    id: String(row.id),
    gurmukhi: String(row.gurmukhi ?? ""),
    romanised: String(row.romanised ?? ""),
    english: String(row.english ?? ""),
  };
}

export async function loadPossessivePracticeContent(
  supabase: SupabaseClient,
  unlockedCourseIds: Set<string>
): Promise<PossessivePracticeContent> {
  const [formsResult, postpositionsResult, nounsResult] = await Promise.all([
    supabase
      .from("possessive_forms")
      .select("*")
      .order("display_order", { ascending: true }),
    supabase.from("postpositions").select("*").order("romanised", { ascending: true }),
    supabase.from("gendered_nouns").select("*").order("english_meaning", { ascending: true }),
  ]);

  const firstError = formsResult.error ?? postpositionsResult.error ?? nounsResult.error;

  if (firstError) {
    if (
      isMissingTable(firstError.message, "possessive_forms") ||
      isMissingTable(firstError.message, "postpositions")
    ) {
      return {
        nouns: [],
        possessiveForms: [],
        postpositions: [],
        tablesReady: false,
        loadError: null,
      };
    }

    return {
      nouns: [],
      possessiveForms: [],
      postpositions: [],
      tablesReady: true,
      loadError: firstError.message,
    };
  }

  const accessibleNouns = filterAccessibleGrammarRows(
    (nounsResult.data ?? []) as GenderedNoun[],
    unlockedCourseIds
  );
  const nouns = await enrichGenderedNounsRomanisation(supabase, accessibleNouns);

  return {
    nouns,
    possessiveForms: (formsResult.data ?? []).map((row) =>
      normalizePossessiveForm(row as Record<string, unknown>)
    ),
    postpositions: (postpositionsResult.data ?? []).map((row) =>
      normalizePostposition(row as Record<string, unknown>)
    ),
    tablesReady: true,
    loadError: null,
  };
}

export function possessivePoolSize(
  tier: string,
  nounCount: number,
  formCount: number,
  postpositionCount: number
): number {
  if (nounCount <= 0 || formCount <= 0) return 0;

  const base = nounCount * formCount;
  if (tier === "oblique") {
    return postpositionCount > 0 ? base * postpositionCount : 0;
  }
  if (tier === "mixed") {
    return postpositionCount > 0 ? base * (1 + postpositionCount) : base;
  }
  return base;
}
