"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import type { ComprehensionTier } from "@/lib/comprehension/tiers";
import {
  COMPREHENSION_DIFFICULTY_MAX,
  COMPREHENSION_DIFFICULTY_MIN,
  COMPREHENSION_TIERS,
} from "@/lib/comprehension/tiers";
import type { AudioAssetStatus } from "@/lib/audio/types";
import { revalidatePath } from "next/cache";

const ADMIN_GAMES_PATH = "/admin/content/games";

export type ComprehensionActionResult = { error?: string; success?: string };

export type AdminComprehensionScript = {
  id: string;
  title: string;
  description: string | null;
  tier: ComprehensionTier | null;
  difficulty: number | null;
  display_order: number;
  active: boolean;
  needs_rewrite: boolean;
};

export type AdminComprehensionParagraph = {
  id: string;
  script_id: string;
  sequence_order: number;
};

export type AdminComprehensionSentence = {
  id: string;
  script_id: string;
  paragraph_id: string | null;
  sequence_order: number;
  gurmukhi_text: string;
  romanised_text: string;
  english_translation: string | null;
  audio_url: string | null;
};

export type AdminComprehensionQuestion = {
  id: string;
  script_id: string;
  related_sentence_id: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "a" | "b" | "c" | "d";
  sequence_order: number;
};

export type AdminComprehensionData = {
  scripts: AdminComprehensionScript[];
  paragraphsByScript: Record<string, AdminComprehensionParagraph[]>;
  sentencesByScript: Record<string, AdminComprehensionSentence[]>;
  questionsByScript: Record<string, AdminComprehensionQuestion[]>;
  audioStatusBySentenceId: Record<string, AudioAssetStatus>;
  error?: string;
};

function parseDifficulty(value: FormDataEntryValue | null): number | null {
  const raw = (value as string)?.trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  return Math.min(COMPREHENSION_DIFFICULTY_MAX, Math.max(COMPREHENSION_DIFFICULTY_MIN, n));
}

function parseTier(value: FormDataEntryValue | null): ComprehensionTier | null {
  const raw = (value as string)?.trim();
  if (COMPREHENSION_TIERS.includes(raw as ComprehensionTier)) {
    return raw as ComprehensionTier;
  }
  return null;
}

function revalidate() {
  revalidatePath(ADMIN_GAMES_PATH);
  revalidatePath("/dashboard/games/comprehension-practice");
}

function isMissingTable(message: string, table: string): boolean {
  return message.toLowerCase().includes(table) && message.toLowerCase().includes("does not exist");
}

export async function loadComprehensionAdminData(): Promise<AdminComprehensionData> {
  try {
    const supabase = await requireAdminFromActions();

    const [scriptsResult, paragraphsResult, sentencesResult, questionsResult] = await Promise.all([
      supabase
        .from("comprehension_scripts")
        .select("*")
        .order("display_order", { ascending: true }),
      supabase
        .from("comprehension_paragraphs")
        .select("*")
        .order("sequence_order", { ascending: true }),
      supabase
        .from("comprehension_sentences")
        .select("*")
        .order("sequence_order", { ascending: true }),
      supabase
        .from("comprehension_questions")
        .select("*")
        .order("sequence_order", { ascending: true }),
    ]);

    const error =
      scriptsResult.error?.message ??
      paragraphsResult.error?.message ??
      sentencesResult.error?.message ??
      questionsResult.error?.message;

    if (error) {
      if (isMissingTable(error, "comprehension_paragraphs")) {
        return {
          scripts: (scriptsResult.data ?? []) as AdminComprehensionScript[],
          paragraphsByScript: {},
          sentencesByScript: {},
          questionsByScript: {},
          audioStatusBySentenceId: {},
          error: `${error} Run supabase/comprehension-paragraphs-tier.sql first.`,
        };
      }

      return {
        scripts: [],
        paragraphsByScript: {},
        sentencesByScript: {},
        questionsByScript: {},
        audioStatusBySentenceId: {},
        error,
      };
    }

    const paragraphsByScript: Record<string, AdminComprehensionParagraph[]> = {};
    for (const row of paragraphsResult.data ?? []) {
      const paragraph = row as AdminComprehensionParagraph;
      if (!paragraphsByScript[paragraph.script_id]) {
        paragraphsByScript[paragraph.script_id] = [];
      }
      paragraphsByScript[paragraph.script_id].push(paragraph);
    }

    const sentencesByScript: Record<string, AdminComprehensionSentence[]> = {};
    const allSentenceIds: string[] = [];
    for (const row of sentencesResult.data ?? []) {
      const sentence = row as AdminComprehensionSentence;
      allSentenceIds.push(sentence.id);
      if (!sentencesByScript[sentence.script_id]) {
        sentencesByScript[sentence.script_id] = [];
      }
      sentencesByScript[sentence.script_id].push(sentence);
    }

    const questionsByScript: Record<string, AdminComprehensionQuestion[]> = {};
    for (const row of questionsResult.data ?? []) {
      const question = row as AdminComprehensionQuestion;
      if (!questionsByScript[question.script_id]) {
        questionsByScript[question.script_id] = [];
      }
      questionsByScript[question.script_id].push(question);
    }

    const audioStatusBySentenceId: Record<string, AudioAssetStatus> = {};
    if (allSentenceIds.length > 0) {
      const { data: audioAssets } = await supabase
        .from("audio_assets")
        .select("content_id, status")
        .eq("content_type", "comprehension_sentence")
        .in("content_id", allSentenceIds);

      for (const asset of audioAssets ?? []) {
        audioStatusBySentenceId[asset.content_id as string] = asset.status as AudioAssetStatus;
      }
    }

    return {
      scripts: (scriptsResult.data ?? []) as AdminComprehensionScript[],
      paragraphsByScript,
      sentencesByScript,
      questionsByScript,
      audioStatusBySentenceId,
    };
  } catch (e) {
    return {
      scripts: [],
      paragraphsByScript: {},
      sentencesByScript: {},
      questionsByScript: {},
      audioStatusBySentenceId: {},
      error: e instanceof Error ? e.message : "Failed to load comprehension content.",
    };
  }
}

export async function createComprehensionScript(
  _prev: ComprehensionActionResult,
  formData: FormData
): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const title = (formData.get("title") as string)?.trim();
    const tier = parseTier(formData.get("tier"));
    if (!title) return { error: "Title is required." };
    if (!tier) return { error: "Tier is required." };

    const { error } = await supabase.from("comprehension_scripts").insert({
      title,
      tier,
      description: (formData.get("description") as string)?.trim() || null,
      difficulty: parseDifficulty(formData.get("difficulty")),
      display_order: parseInt((formData.get("display_order") as string) || "0", 10) || 0,
      active: formData.get("active") === "on",
      needs_rewrite: false,
    });

    if (error) return { error: error.message };
    revalidate();
    return { success: "Script created — add paragraphs, then sentences." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create script." };
  }
}

export async function updateComprehensionScript(
  _prev: ComprehensionActionResult,
  formData: FormData
): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const title = (formData.get("title") as string)?.trim();
    const tier = parseTier(formData.get("tier"));
    if (!id || !title) return { error: "Title is required." };
    if (!tier) return { error: "Tier is required." };

    const { error } = await supabase
      .from("comprehension_scripts")
      .update({
        title,
        tier,
        description: (formData.get("description") as string)?.trim() || null,
        difficulty: parseDifficulty(formData.get("difficulty")),
        display_order: parseInt((formData.get("display_order") as string) || "0", 10) || 0,
        active: formData.get("active") === "on",
        needs_rewrite: formData.get("needs_rewrite") === "on",
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidate();
    return { success: "Script updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update script." };
  }
}

export async function deleteComprehensionScript(scriptId: string): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();

    const { data: sentences } = await supabase
      .from("comprehension_sentences")
      .select("id")
      .eq("script_id", scriptId);

    const sentenceIds = (sentences ?? []).map((row) => row.id as string);
    if (sentenceIds.length > 0) {
      await supabase
        .from("audio_assets")
        .delete()
        .eq("content_type", "comprehension_sentence")
        .in("content_id", sentenceIds);
    }

    const { error } = await supabase.from("comprehension_scripts").delete().eq("id", scriptId);
    if (error) return { error: error.message };
    revalidate();
    return { success: "Script deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete script." };
  }
}

export async function createComprehensionParagraph(
  _prev: ComprehensionActionResult,
  formData: FormData
): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const scriptId = (formData.get("script_id") as string)?.trim();
    if (!scriptId) return { error: "Script is required." };

    const { error } = await supabase.from("comprehension_paragraphs").insert({
      script_id: scriptId,
      sequence_order: parseInt((formData.get("sequence_order") as string) || "1", 10) || 1,
    });

    if (error) return { error: error.message };
    revalidate();
    return { success: "Paragraph added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add paragraph." };
  }
}

export async function deleteComprehensionParagraph(
  paragraphId: string
): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();

    const { count } = await supabase
      .from("comprehension_sentences")
      .select("id", { count: "exact", head: true })
      .eq("paragraph_id", paragraphId);

    if ((count ?? 0) > 0) {
      return { error: "Remove or move sentences in this paragraph first." };
    }

    const { error } = await supabase
      .from("comprehension_paragraphs")
      .delete()
      .eq("id", paragraphId);

    if (error) return { error: error.message };
    revalidate();
    return { success: "Paragraph removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove paragraph." };
  }
}

export async function createComprehensionSentence(
  _prev: ComprehensionActionResult,
  formData: FormData
): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const scriptId = formData.get("script_id") as string;
    const paragraphId = (formData.get("paragraph_id") as string)?.trim();
    const gurmukhi = (formData.get("gurmukhi_text") as string)?.trim();
    const romanised = (formData.get("romanised_text") as string)?.trim();
    if (!scriptId || !paragraphId || !gurmukhi || !romanised) {
      return { error: "Paragraph, Gurmukhi, and romanised text are required." };
    }

    const { error } = await supabase.from("comprehension_sentences").insert({
      script_id: scriptId,
      paragraph_id: paragraphId,
      sequence_order: parseInt((formData.get("sequence_order") as string) || "1", 10) || 1,
      gurmukhi_text: gurmukhi,
      romanised_text: romanised,
      english_translation: (formData.get("english_translation") as string)?.trim() || null,
    });

    if (error) return { error: error.message };
    revalidate();
    return { success: "Sentence added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add sentence." };
  }
}

export async function updateComprehensionSentence(
  _prev: ComprehensionActionResult,
  formData: FormData
): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const id = formData.get("id") as string;
    const paragraphId = (formData.get("paragraph_id") as string)?.trim();
    const gurmukhi = (formData.get("gurmukhi_text") as string)?.trim();
    const romanised = (formData.get("romanised_text") as string)?.trim();
    if (!id || !paragraphId || !gurmukhi || !romanised) {
      return { error: "Paragraph, Gurmukhi, and romanised text are required." };
    }

    const { error } = await supabase
      .from("comprehension_sentences")
      .update({
        paragraph_id: paragraphId,
        sequence_order: parseInt((formData.get("sequence_order") as string) || "1", 10) || 1,
        gurmukhi_text: gurmukhi,
        romanised_text: romanised,
        english_translation: (formData.get("english_translation") as string)?.trim() || null,
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidate();
    return { success: "Sentence updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update sentence." };
  }
}

export async function deleteComprehensionSentence(
  sentenceId: string
): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    await supabase
      .from("audio_assets")
      .delete()
      .eq("content_type", "comprehension_sentence")
      .eq("content_id", sentenceId);

    const { error } = await supabase
      .from("comprehension_sentences")
      .delete()
      .eq("id", sentenceId);
    if (error) return { error: error.message };
    revalidate();
    return { success: "Sentence deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete sentence." };
  }
}

export async function createComprehensionQuestion(
  _prev: ComprehensionActionResult,
  formData: FormData
): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const scriptId = formData.get("script_id") as string;
    const questionText = (formData.get("question_text") as string)?.trim();
    const optionA = (formData.get("option_a") as string)?.trim();
    const optionB = (formData.get("option_b") as string)?.trim();
    const optionC = (formData.get("option_c") as string)?.trim();
    const optionD = (formData.get("option_d") as string)?.trim();
    const correct = ((formData.get("correct_option") as string) || "a").toLowerCase();

    if (!scriptId || !questionText || !optionA || !optionB || !optionC || !optionD) {
      return { error: "All question fields are required." };
    }

    const { error } = await supabase.from("comprehension_questions").insert({
      script_id: scriptId,
      related_sentence_id: (formData.get("related_sentence_id") as string)?.trim() || null,
      question_text: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_option: correct,
      sequence_order: parseInt((formData.get("sequence_order") as string) || "0", 10) || 0,
    });

    if (error) return { error: error.message };
    revalidate();
    return { success: "Question added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add question." };
  }
}

export async function deleteComprehensionQuestion(
  questionId: string
): Promise<ComprehensionActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { error } = await supabase
      .from("comprehension_questions")
      .delete()
      .eq("id", questionId);
    if (error) return { error: error.message };
    revalidate();
    return { success: "Question deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete question." };
  }
}
