import type { SupabaseClient } from "@supabase/supabase-js";
import { hasAccessToCourse } from "@/lib/membership/access";
import type { GenderedNoun } from "@/lib/games/types";
import { enrichGenderedNounsRomanisation } from "@/lib/games/enrich-gendered-nouns";

export function canAccessGrammarDifficulty(
  unlockedCourseIds: Set<string>,
  difficulty: number,
  courseId: string | null
): boolean {
  if (difficulty <= 1) return true;
  if (!courseId) return false;
  return hasAccessToCourse(unlockedCourseIds, courseId);
}

export function filterAccessibleGrammarRows<
  T extends { difficulty: number; course_id: string | null },
>(rows: T[], unlockedCourseIds: Set<string>): T[] {
  return rows.filter((row) =>
    canAccessGrammarDifficulty(unlockedCourseIds, row.difficulty, row.course_id)
  );
}

export async function fetchAccessibleGrammarSentences(
  supabase: SupabaseClient,
  unlockedCourseIds: Set<string>,
  filters?: { difficulty?: number; topicTag?: string }
) {
  let query = supabase
    .from("grammar_sentences")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.difficulty) {
    query = query.eq("difficulty", filters.difficulty);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = filterAccessibleGrammarRows(data ?? [], unlockedCourseIds);

  if (filters?.topicTag) {
    const tag = filters.topicTag.toLowerCase();
    rows = rows.filter((row) =>
      (row.topic_tags ?? []).some((t: string) => t.toLowerCase() === tag)
    );
  }

  return rows;
}

export async function fetchAccessibleVerbs(
  supabase: SupabaseClient,
  unlockedCourseIds: Set<string>,
  difficulty?: number
) {
  let query = supabase.from("verb_conjugations").select("*").order("verb_root");
  if (difficulty) query = query.eq("difficulty", difficulty);

  const { data, error } = await query;
  if (error) throw error;

  return filterAccessibleGrammarRows(data ?? [], unlockedCourseIds);
}

export async function fetchAccessibleGenderedNouns(
  supabase: SupabaseClient,
  unlockedCourseIds: Set<string>,
  difficulty?: number
): Promise<GenderedNoun[]> {
  let query = supabase.from("gendered_nouns").select("*").order("punjabi_word");
  if (difficulty) query = query.eq("difficulty", difficulty);

  const { data, error } = await query;
  if (error) throw error;

  const rows = filterAccessibleGrammarRows(
    (data ?? []) as GenderedNoun[],
    unlockedCourseIds
  );

  return enrichGenderedNounsRomanisation(supabase, rows);
}

export async function fetchGrammarTopicTags(
  supabase: SupabaseClient,
  unlockedCourseIds: Set<string>
) {
  const sentences = await fetchAccessibleGrammarSentences(supabase, unlockedCourseIds);
  const tags = new Set<string>();
  for (const row of sentences) {
    for (const tag of row.topic_tags ?? []) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}
