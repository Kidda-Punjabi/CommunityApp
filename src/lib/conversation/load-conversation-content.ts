import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConversationCharacter,
  ConversationExchange,
  ConversationHardWordTile,
  ConversationPracticeContent,
  ConversationScenario,
} from "./types";

function isMissingTable(message: string, table: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes(table) && lower.includes("does not exist");
}

export function parseHardWordTiles(raw: unknown): ConversationHardWordTile[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const gurmukhi = String(record.gurmukhi ?? "").trim();
      if (!gurmukhi) return null;

      return {
        gurmukhi,
        romanised: String(record.romanised ?? "").trim(),
        correct_position: Number(record.correct_position ?? 0),
        is_distractor: Boolean(record.is_distractor),
      };
    })
    .filter((entry): entry is ConversationHardWordTile => entry !== null);
}

function normalizeCharacter(row: Record<string, unknown>): ConversationCharacter {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    role: String(row.role ?? ""),
    description: row.description ? String(row.description) : null,
    icon_name: row.icon_name ? String(row.icon_name) : null,
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    display_order: Number(row.display_order ?? 0),
    active: Boolean(row.active ?? true),
  };
}

function normalizeScenario(row: Record<string, unknown>): ConversationScenario {
  return {
    id: String(row.id),
    character_id: String(row.character_id),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : null,
    display_order: Number(row.display_order ?? 0),
    active: Boolean(row.active ?? true),
  };
}

function normalizeExchange(row: Record<string, unknown>): ConversationExchange {
  return {
    id: String(row.id),
    scenario_id: String(row.scenario_id),
    sequence_order: Number(row.sequence_order ?? 0),
    npc_setup_gurmukhi: String(row.npc_setup_gurmukhi ?? ""),
    npc_setup_romanised: row.npc_setup_romanised ? String(row.npc_setup_romanised) : null,
    npc_setup_english: String(row.npc_setup_english ?? ""),
    prompt_instruction: String(row.prompt_instruction ?? ""),
    target_response_gurmukhi: String(row.target_response_gurmukhi ?? ""),
    target_response_romanised: row.target_response_romanised
      ? String(row.target_response_romanised)
      : null,
    target_response_english: String(row.target_response_english ?? ""),
    npc_reply_gurmukhi: row.npc_reply_gurmukhi ? String(row.npc_reply_gurmukhi) : null,
    npc_reply_romanised: row.npc_reply_romanised ? String(row.npc_reply_romanised) : null,
    npc_reply_english: row.npc_reply_english ? String(row.npc_reply_english) : null,
    is_ending: Boolean(row.is_ending),
    easy_blank_template_gurmukhi: String(row.easy_blank_template_gurmukhi ?? ""),
    easy_correct_word_gurmukhi: String(row.easy_correct_word_gurmukhi ?? ""),
    easy_correct_word_romanised: row.easy_correct_word_romanised
      ? String(row.easy_correct_word_romanised)
      : null,
    easy_option_b_gurmukhi: String(row.easy_option_b_gurmukhi ?? ""),
    easy_option_b_romanised: row.easy_option_b_romanised ? String(row.easy_option_b_romanised) : null,
    easy_option_c_gurmukhi: String(row.easy_option_c_gurmukhi ?? ""),
    easy_option_c_romanised: row.easy_option_c_romanised ? String(row.easy_option_c_romanised) : null,
    easy_option_d_gurmukhi: String(row.easy_option_d_gurmukhi ?? ""),
    easy_option_d_romanised: row.easy_option_d_romanised ? String(row.easy_option_d_romanised) : null,
    medium_option_b_gurmukhi: String(row.medium_option_b_gurmukhi ?? ""),
    medium_option_b_romanised: row.medium_option_b_romanised
      ? String(row.medium_option_b_romanised)
      : null,
    medium_option_b_english: String(row.medium_option_b_english ?? ""),
    medium_option_c_gurmukhi: String(row.medium_option_c_gurmukhi ?? ""),
    medium_option_c_romanised: row.medium_option_c_romanised
      ? String(row.medium_option_c_romanised)
      : null,
    medium_option_c_english: String(row.medium_option_c_english ?? ""),
    medium_option_d_gurmukhi: String(row.medium_option_d_gurmukhi ?? ""),
    medium_option_d_romanised: row.medium_option_d_romanised
      ? String(row.medium_option_d_romanised)
      : null,
    medium_option_d_english: String(row.medium_option_d_english ?? ""),
    hard_word_tiles: parseHardWordTiles(row.hard_word_tiles),
  };
}

export async function loadConversationPracticeContent(
  supabase: SupabaseClient
): Promise<ConversationPracticeContent> {
  const [charactersResult, scenariosResult, exchangesResult] = await Promise.all([
    supabase
      .from("conversation_characters")
      .select("*")
      .eq("active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("conversation_scenarios")
      .select("*")
      .eq("active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("conversation_exchanges")
      .select("*")
      .order("sequence_order", { ascending: true }),
  ]);

  const firstError =
    charactersResult.error ?? scenariosResult.error ?? exchangesResult.error;

  if (firstError) {
    if (
      isMissingTable(firstError.message, "conversation_characters") ||
      isMissingTable(firstError.message, "conversation_scenarios") ||
      isMissingTable(firstError.message, "conversation_exchanges")
    ) {
      return {
        characters: [],
        scenarios: [],
        exchangesByScenario: {},
        tableReady: false,
        loadError: null,
      };
    }

    return {
      characters: [],
      scenarios: [],
      exchangesByScenario: {},
      tableReady: true,
      loadError: firstError.message,
    };
  }

  const characters = (charactersResult.data ?? []).map((row) =>
    normalizeCharacter(row as Record<string, unknown>)
  );
  const scenarios = (scenariosResult.data ?? []).map((row) =>
    normalizeScenario(row as Record<string, unknown>)
  );

  const exchangesByScenario: Record<string, ConversationExchange[]> = {};
  for (const row of exchangesResult.data ?? []) {
    const exchange = normalizeExchange(row as Record<string, unknown>);
    if (!exchangesByScenario[exchange.scenario_id]) {
      exchangesByScenario[exchange.scenario_id] = [];
    }
    exchangesByScenario[exchange.scenario_id].push(exchange);
  }

  for (const scenarioId of Object.keys(exchangesByScenario)) {
    exchangesByScenario[scenarioId].sort((a, b) => a.sequence_order - b.sequence_order);
  }

  return {
    characters,
    scenarios,
    exchangesByScenario,
    tableReady: true,
    loadError: null,
  };
}
