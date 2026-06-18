"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { revalidatePath } from "next/cache";
import {
  parseTopicTags,
  splitPunjabiTiles,
  type VerbConjugations,
} from "@/lib/games/types";

const ADMIN_PATH = "/admin/content";

export type GrammarActionResult = { error?: string; success?: string };

function parseNullableUuid(value: FormDataEntryValue | null): string | null {
  const raw = (value as string)?.trim();
  return raw || null;
}

function parseDifficulty(value: FormDataEntryValue | null): number {
  const n = parseInt((value as string) || "1", 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(5, Math.max(1, n));
}

function parseWordTiles(formData: FormData): string[] {
  const raw = (formData.get("word_tiles") as string)?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.length) return parsed.map(String);
    } catch {
      // fall through
    }
  }
  const sentence = (formData.get("punjabi_sentence") as string)?.trim() ?? "";
  return splitPunjabiTiles(sentence);
}

// ---- Grammar sentences ----

export async function createGrammarSentence(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const punjabi = (formData.get("punjabi_sentence") as string)?.trim();
    const english = (formData.get("english_translation") as string)?.trim();
    if (!punjabi || !english) return { error: "Punjabi sentence and English translation are required." };

    const { error } = await supabase.from("grammar_sentences").insert({
      punjabi_sentence: punjabi,
      english_translation: english,
      word_tiles: parseWordTiles(formData),
      difficulty: parseDifficulty(formData.get("difficulty")),
      topic_tags: parseTopicTags((formData.get("topic_tags") as string) || ""),
      course_id: parseNullableUuid(formData.get("course_id")),
    });

    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Sentence added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add sentence." };
  }
}

export async function updateGrammarSentence(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const punjabi = (formData.get("punjabi_sentence") as string)?.trim();
    const english = (formData.get("english_translation") as string)?.trim();
    if (!id || !punjabi || !english) return { error: "Missing required fields." };

    const { error } = await supabase
      .from("grammar_sentences")
      .update({
        punjabi_sentence: punjabi,
        english_translation: english,
        word_tiles: parseWordTiles(formData),
        difficulty: parseDifficulty(formData.get("difficulty")),
        topic_tags: parseTopicTags((formData.get("topic_tags") as string) || ""),
        course_id: parseNullableUuid(formData.get("course_id")),
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Sentence updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update sentence." };
  }
}

export async function deleteGrammarSentence(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const { error } = await supabase.from("grammar_sentences").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Sentence deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete sentence." };
  }
}

export async function bulkCreateGrammarSentences(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const raw = (formData.get("bulk_text") as string)?.trim();
    if (!raw) return { error: "Paste bulk content first." };

    const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    const rows = [];

    for (const block of blocks) {
      const punjabi = block.match(/PUNJABI:\s*(.+)/i)?.[1]?.trim();
      const english = block.match(/ENGLISH:\s*(.+)/i)?.[1]?.trim();
      const difficulty = parseInt(block.match(/DIFFICULTY:\s*(\d)/i)?.[1] ?? "1", 10);
      const tagsRaw = block.match(/TAGS:\s*(.+)/i)?.[1]?.trim() ?? "";
      if (!punjabi || !english) continue;
      rows.push({
        punjabi_sentence: punjabi,
        english_translation: english,
        word_tiles: splitPunjabiTiles(punjabi),
        difficulty: Math.min(5, Math.max(1, difficulty)),
        topic_tags: parseTopicTags(tagsRaw),
        course_id: parseNullableUuid(formData.get("course_id")),
      });
    }

    if (!rows.length) return { error: "No valid sentences found in bulk text." };

    const { error } = await supabase.from("grammar_sentences").insert(rows);
    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: `Imported ${rows.length} sentence(s).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk import failed." };
  }
}

// ---- Verb conjugations ----

function parseConjugationsFromForm(formData: FormData): VerbConjugations {
  const keys = [
    "present_singular_masculine",
    "present_singular_feminine",
    "present_plural_masculine",
    "present_plural_feminine",
    "past_singular_masculine",
    "past_singular_feminine",
    "past_plural_masculine",
    "past_plural_feminine",
    "future_singular_masculine",
    "future_singular_feminine",
    "future_plural_masculine",
    "future_plural_feminine",
  ] as const;

  const conjugations: VerbConjugations = {};
  for (const key of keys) {
    const value = (formData.get(key) as string)?.trim();
    if (!value) continue;
    const [tense, number, gender] = key.split("_") as [
      "present" | "past" | "future",
      "singular" | "plural",
      "masculine" | "feminine",
    ];
    conjugations[tense] ??= {};
    conjugations[tense]![number] ??= {};
    conjugations[tense]![number]![gender] = value;
  }
  return conjugations;
}

function parseConjugationsFromBulk(block: string): VerbConjugations {
  const conjugations: VerbConjugations = {};
  const lines = block.split("\n");
  for (const line of lines) {
    const match = line.match(/^([a-z_]+):\s*(.+)$/i);
    if (!match) continue;
    const [, key, value] = match;
    if (!key.includes("_")) continue;
    const parts = key.toLowerCase().split("_");
    if (parts.length < 3) continue;
    const tense = parts[0] as "present" | "past" | "future";
    const number = parts[1] as "singular" | "plural";
    const gender = parts[2] as "masculine" | "feminine";
    if (!["present", "past", "future"].includes(tense)) continue;
    conjugations[tense] ??= {};
    conjugations[tense]![number] ??= {};
    conjugations[tense]![number]![gender] = value.trim();
  }
  return conjugations;
}

export async function createVerbConjugation(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const root = (formData.get("verb_root") as string)?.trim();
    const meaning = (formData.get("verb_meaning") as string)?.trim();
    if (!root || !meaning) return { error: "Verb root and meaning are required." };

    const { error } = await supabase.from("verb_conjugations").insert({
      verb_root: root,
      verb_meaning: meaning,
      conjugations: parseConjugationsFromForm(formData),
      difficulty: parseDifficulty(formData.get("difficulty")),
      course_id: parseNullableUuid(formData.get("course_id")),
    });

    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Verb added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add verb." };
  }
}

export async function updateVerbConjugation(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const root = (formData.get("verb_root") as string)?.trim();
    const meaning = (formData.get("verb_meaning") as string)?.trim();
    if (!id || !root || !meaning) return { error: "Missing required fields." };

    const { error } = await supabase
      .from("verb_conjugations")
      .update({
        verb_root: root,
        verb_meaning: meaning,
        conjugations: parseConjugationsFromForm(formData),
        difficulty: parseDifficulty(formData.get("difficulty")),
        course_id: parseNullableUuid(formData.get("course_id")),
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Verb updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update verb." };
  }
}

export async function deleteVerbConjugation(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const { error } = await supabase.from("verb_conjugations").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Verb deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete verb." };
  }
}

export async function bulkCreateVerbConjugations(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const raw = (formData.get("bulk_text") as string)?.trim();
    if (!raw) return { error: "Paste bulk content first." };

    const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    const rows = [];

    for (const block of blocks) {
      const root = block.match(/VERB:\s*(.+)/i)?.[1]?.trim();
      const meaning = block.match(/MEANING:\s*(.+)/i)?.[1]?.trim();
      const difficulty = parseInt(block.match(/DIFFICULTY:\s*(\d)/i)?.[1] ?? "1", 10);
      if (!root || !meaning) continue;
      rows.push({
        verb_root: root,
        verb_meaning: meaning,
        conjugations: parseConjugationsFromBulk(block),
        difficulty: Math.min(5, Math.max(1, difficulty)),
        course_id: parseNullableUuid(formData.get("course_id")),
      });
    }

    if (!rows.length) return { error: "No valid verbs found in bulk text." };

    const { error } = await supabase.from("verb_conjugations").insert(rows);
    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: `Imported ${rows.length} verb(s).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk import failed." };
  }
}

// ---- Gendered nouns ----

export async function createGenderedNoun(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const word = (formData.get("punjabi_word") as string)?.trim();
    const meaning = (formData.get("english_meaning") as string)?.trim();
    const gender = formData.get("gender") as string;
    if (!word || !meaning) return { error: "Punjabi word and English meaning are required." };
    if (gender !== "masculine" && gender !== "feminine") return { error: "Select a gender." };

    const { error } = await supabase.from("gendered_nouns").insert({
      punjabi_word: word,
      english_meaning: meaning,
      gender,
      difficulty: parseDifficulty(formData.get("difficulty")),
      topic_tags: parseTopicTags((formData.get("topic_tags") as string) || ""),
      course_id: parseNullableUuid(formData.get("course_id")),
    });

    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Noun added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add noun." };
  }
}

export async function updateGenderedNoun(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const word = (formData.get("punjabi_word") as string)?.trim();
    const meaning = (formData.get("english_meaning") as string)?.trim();
    const gender = formData.get("gender") as string;
    if (!id || !word || !meaning) return { error: "Missing required fields." };

    const { error } = await supabase
      .from("gendered_nouns")
      .update({
        punjabi_word: word,
        english_meaning: meaning,
        gender: gender === "feminine" ? "feminine" : "masculine",
        difficulty: parseDifficulty(formData.get("difficulty")),
        topic_tags: parseTopicTags((formData.get("topic_tags") as string) || ""),
        course_id: parseNullableUuid(formData.get("course_id")),
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Noun updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update noun." };
  }
}

export async function deleteGenderedNoun(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const { error } = await supabase.from("gendered_nouns").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Noun deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete noun." };
  }
}

export async function bulkCreateGenderedNouns(
  _prev: GrammarActionResult,
  formData: FormData
): Promise<GrammarActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const raw = (formData.get("bulk_text") as string)?.trim();
    if (!raw) return { error: "Paste bulk content first." };

    const rows = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split("\t");
      if (parts.length < 3) continue;
      const [word, meaning, genderRaw, diffRaw] = parts;
      const gender = genderRaw?.trim().toLowerCase();
      if (gender !== "masculine" && gender !== "feminine") continue;
      rows.push({
        punjabi_word: word.trim(),
        english_meaning: meaning.trim(),
        gender,
        difficulty: Math.min(5, Math.max(1, parseInt(diffRaw ?? "1", 10) || 1)),
        topic_tags: [],
        course_id: parseNullableUuid(formData.get("course_id")),
      });
    }

    if (!rows.length) return { error: "No valid rows found. Use tab-separated format." };

    const { error } = await supabase.from("gendered_nouns").insert(rows);
    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: `Imported ${rows.length} noun(s).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk import failed." };
  }
}
