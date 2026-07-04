import type { SupabaseClient } from "@supabase/supabase-js";
import {
  approvedAudioUrlFromAsset,
  loadAudioAssetsForContentIds,
} from "@/lib/audio/load-audio-asset";
import { orderSentencesForScript } from "@/lib/comprehension/order-sentences";
import {
  filterLearnerScripts,
  scriptListeningReady,
} from "@/lib/comprehension/learner-scripts";
import type {
  ComprehensionParagraph,
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
  const tierRaw = row.tier ? String(row.tier) : null;
  const tier =
    tierRaw === "short" || tierRaw === "medium" || tierRaw === "long" ? tierRaw : null;

  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : null,
    tier,
    difficulty: row.difficulty == null ? null : Number(row.difficulty),
    display_order: Number(row.display_order ?? 0),
    active: Boolean(row.active ?? true),
    needs_rewrite: Boolean(row.needs_rewrite ?? false),
  };
}

function normalizeParagraph(row: Record<string, unknown>): ComprehensionParagraph {
  return {
    id: String(row.id),
    script_id: String(row.script_id),
    sequence_order: Number(row.sequence_order ?? 0),
  };
}

function normalizeSentence(row: Record<string, unknown>): ComprehensionSentence {
  return {
    id: String(row.id),
    script_id: String(row.script_id),
    paragraph_id: row.paragraph_id ? String(row.paragraph_id) : null,
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
  return scriptListeningReady(sentences);
}

export async function loadComprehensionPracticeContent(
  supabase: SupabaseClient
): Promise<ComprehensionPracticeContent> {
  const [scriptsResult, paragraphsResult, sentencesResult, questionsResult] = await Promise.all([
    supabase
      .from("comprehension_scripts")
      .select("*")
      .eq("active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("comprehension_paragraphs")
      .select("*")
      .order("sequence_order", { ascending: true }),
    supabase.from("comprehension_sentences").select("*").order("sequence_order", { ascending: true }),
    supabase.from("comprehension_questions").select("*").order("sequence_order", { ascending: true }),
  ]);

  const firstError =
    scriptsResult.error ??
    paragraphsResult.error ??
    sentencesResult.error ??
    questionsResult.error;

  if (firstError) {
    if (
      isMissingTable(firstError.message, "comprehension_scripts") ||
      isMissingTable(firstError.message, "comprehension_sentences") ||
      isMissingTable(firstError.message, "comprehension_questions")
    ) {
      return {
        scripts: [],
        paragraphsByScript: {},
        sentencesByScript: {},
        questionsByScript: {},
        tablesReady: false,
        loadError: null,
      };
    }

    if (isMissingTable(firstError.message, "comprehension_paragraphs")) {
      return {
        scripts: [],
        paragraphsByScript: {},
        sentencesByScript: {},
        questionsByScript: {},
        tablesReady: true,
        loadError:
          "Run supabase/comprehension-paragraphs-tier.sql to enable tiered paragraph structure.",
      };
    }

    return {
      scripts: [],
      paragraphsByScript: {},
      sentencesByScript: {},
      questionsByScript: {},
      tablesReady: true,
      loadError: firstError.message,
    };
  }

  const paragraphsByScript: Record<string, ComprehensionParagraph[]> = {};
  for (const row of paragraphsResult.data ?? []) {
    const paragraph = normalizeParagraph(row as Record<string, unknown>);
    if (!paragraphsByScript[paragraph.script_id]) {
      paragraphsByScript[paragraph.script_id] = [];
    }
    paragraphsByScript[paragraph.script_id].push(paragraph);
  }

  const rawSentencesByScript: Record<string, ComprehensionSentence[]> = {};
  for (const row of sentencesResult.data ?? []) {
    const sentence = normalizeSentence(row as Record<string, unknown>);
    if (!rawSentencesByScript[sentence.script_id]) {
      rawSentencesByScript[sentence.script_id] = [];
    }
    rawSentencesByScript[sentence.script_id].push(sentence);
  }

  const sentenceIds = Object.values(rawSentencesByScript)
    .flat()
    .map((sentence) => sentence.id);
  const audioAssets = await loadAudioAssetsForContentIds(
    supabase,
    "comprehension_sentence",
    sentenceIds
  );

  const sentencesByScript: Record<string, ComprehensionSentence[]> = {};
  for (const scriptId of Object.keys(rawSentencesByScript)) {
    const paragraphs = paragraphsByScript[scriptId] ?? [];
    const withAudio = rawSentencesByScript[scriptId].map((sentence) => {
      const asset = audioAssets.get(sentence.id);
      const approvedUrl = approvedAudioUrlFromAsset(asset);
      return {
        ...sentence,
        audio_url: approvedUrl ?? sentence.audio_url,
      };
    });
    sentencesByScript[scriptId] = orderSentencesForScript(paragraphs, withAudio);
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

  const allSummaries: ComprehensionScriptSummary[] = (scriptsResult.data ?? []).map((row) => {
    const script = normalizeScript(row as Record<string, unknown>);
    const paragraphs = paragraphsByScript[script.id] ?? [];
    const sentences = sentencesByScript[script.id] ?? [];
    const questions = questionsByScript[script.id] ?? [];
    return {
      ...script,
      paragraph_count: paragraphs.length,
      sentence_count: sentences.length,
      question_count: questions.length,
      listening_ready: listeningReady(sentences),
    };
  });

  const scripts = filterLearnerScripts(allSummaries, sentencesByScript, questionsByScript);

  const learnerScriptIds = new Set(scripts.map((script) => script.id));
  const filteredSentencesByScript: Record<string, ComprehensionSentence[]> = {};
  const filteredQuestionsByScript: Record<string, ComprehensionQuestion[]> = {};

  for (const scriptId of learnerScriptIds) {
    filteredSentencesByScript[scriptId] = sentencesByScript[scriptId] ?? [];
    filteredQuestionsByScript[scriptId] = questionsByScript[scriptId] ?? [];
  }

  return {
    scripts,
    paragraphsByScript,
    sentencesByScript: filteredSentencesByScript,
    questionsByScript: filteredQuestionsByScript,
    tablesReady: true,
    loadError: null,
  };
}
