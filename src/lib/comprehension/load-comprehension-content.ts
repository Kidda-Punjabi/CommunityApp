import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ComprehensionPracticeContent,
  ComprehensionQuestion,
  ComprehensionScript,
  ComprehensionScriptSummary,
  ComprehensionSentence,
} from "./types";

function isMissingTable(message: string, table: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes(table) && lower.includes("does not exist");
}

function normalizeScript(row: Record<string, unknown>): ComprehensionScript {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : null,
    difficulty: row.difficulty == null ? null : Number(row.difficulty),
    display_order: Number(row.display_order ?? 0),
    active: Boolean(row.active ?? true),
  };
}

function normalizeSentence(row: Record<string, unknown>): ComprehensionSentence {
  return {
    id: String(row.id),
    script_id: String(row.script_id),
    sequence_order: Number(row.sequence_order ?? 0),
    gurmukhi_text: String(row.gurmukhi_text ?? ""),
    romanised_text: String(row.romanised_text ?? ""),
    english_translation: row.english_translation ? String(row.english_translation) : null,
    audio_url: row.audio_url ? String(row.audio_url) : null,
  };
}

function normalizeQuestion(row: Record<string, unknown>): ComprehensionQuestion {
  const correct = String(row.correct_option ?? "a").toLowerCase();
  return {
    id: String(row.id),
    script_id: String(row.script_id),
    related_sentence_id: row.related_sentence_id ? String(row.related_sentence_id) : null,
    question_text: String(row.question_text ?? ""),
    option_a: String(row.option_a ?? ""),
    option_b: String(row.option_b ?? ""),
    option_c: String(row.option_c ?? ""),
    option_d: String(row.option_d ?? ""),
    correct_option: (["a", "b", "c", "d"].includes(correct) ? correct : "a") as
      | "a"
      | "b"
      | "c"
      | "d",
    sequence_order: Number(row.sequence_order ?? 0),
  };
}

function listeningReady(sentences: ComprehensionSentence[]): boolean {
  if (sentences.length === 0) return false;
  return sentences.every((sentence) => Boolean(sentence.audio_url?.trim()));
}

export async function loadComprehensionPracticeContent(
  supabase: SupabaseClient
): Promise<ComprehensionPracticeContent> {
  const [scriptsResult, sentencesResult, questionsResult] = await Promise.all([
    supabase
      .from("comprehension_scripts")
      .select("*")
      .eq("active", true)
      .order("display_order", { ascending: true }),
    supabase.from("comprehension_sentences").select("*").order("sequence_order", { ascending: true }),
    supabase.from("comprehension_questions").select("*").order("sequence_order", { ascending: true }),
  ]);

  const firstError =
    scriptsResult.error ?? sentencesResult.error ?? questionsResult.error;

  if (firstError) {
    if (
      isMissingTable(firstError.message, "comprehension_scripts") ||
      isMissingTable(firstError.message, "comprehension_sentences") ||
      isMissingTable(firstError.message, "comprehension_questions")
    ) {
      return {
        scripts: [],
        sentencesByScript: {},
        questionsByScript: {},
        tablesReady: false,
        loadError: null,
      };
    }

    return {
      scripts: [],
      sentencesByScript: {},
      questionsByScript: {},
      tablesReady: true,
      loadError: firstError.message,
    };
  }

  const sentencesByScript: Record<string, ComprehensionSentence[]> = {};
  for (const row of sentencesResult.data ?? []) {
    const sentence = normalizeSentence(row as Record<string, unknown>);
    if (!sentencesByScript[sentence.script_id]) {
      sentencesByScript[sentence.script_id] = [];
    }
    sentencesByScript[sentence.script_id].push(sentence);
  }

  for (const scriptId of Object.keys(sentencesByScript)) {
    sentencesByScript[scriptId].sort((a, b) => a.sequence_order - b.sequence_order);
  }

  const questionsByScript: Record<string, ComprehensionQuestion[]> = {};
  for (const row of questionsResult.data ?? []) {
    const question = normalizeQuestion(row as Record<string, unknown>);
    if (!questionsByScript[question.script_id]) {
      questionsByScript[question.script_id] = [];
    }
    questionsByScript[question.script_id].push(question);
  }

  for (const scriptId of Object.keys(questionsByScript)) {
    questionsByScript[scriptId].sort((a, b) => a.sequence_order - b.sequence_order);
  }

  const scripts: ComprehensionScriptSummary[] = (scriptsResult.data ?? []).map((row) => {
    const script = normalizeScript(row as Record<string, unknown>);
    const sentences = sentencesByScript[script.id] ?? [];
    const questions = questionsByScript[script.id] ?? [];
    return {
      ...script,
      sentence_count: sentences.length,
      question_count: questions.length,
      listening_ready: listeningReady(sentences),
    };
  });

  return {
    scripts,
    sentencesByScript,
    questionsByScript,
    tablesReady: true,
    loadError: null,
  };
}
