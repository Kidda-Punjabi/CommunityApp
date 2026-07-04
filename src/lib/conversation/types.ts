import type { ConversationDifficulty } from "./config";
import type { ExchangeAudioById } from "./exchange-audio-types";

/** Hard-mode tile — extends grammar word_tiles with position + distractor flags. */
export type ConversationHardWordTile = {
  gurmukhi: string;
  romanised: string;
  correct_position: number;
  is_distractor: boolean;
};

export type ConversationCharacter = {
  id: string;
  name: string;
  role: string;
  description: string | null;
  icon_name: string | null;
  avatar_url: string | null;
  display_order: number;
  active: boolean;
};

export type ConversationScenario = {
  id: string;
  character_id: string;
  title: string;
  description: string | null;
  display_order: number;
  active: boolean;
};

export type ConversationExchange = {
  id: string;
  scenario_id: string;
  sequence_order: number;
  npc_setup_gurmukhi: string;
  npc_setup_romanised: string | null;
  npc_setup_english: string;
  prompt_instruction: string;
  target_response_gurmukhi: string;
  target_response_romanised: string | null;
  target_response_english: string;
  npc_reply_gurmukhi: string | null;
  npc_reply_romanised: string | null;
  npc_reply_english: string | null;
  is_ending: boolean;
  easy_blank_template_gurmukhi: string;
  easy_correct_word_gurmukhi: string;
  easy_correct_word_romanised: string | null;
  easy_option_b_gurmukhi: string;
  easy_option_b_romanised: string | null;
  easy_option_c_gurmukhi: string;
  easy_option_c_romanised: string | null;
  easy_option_d_gurmukhi: string;
  easy_option_d_romanised: string | null;
  medium_option_b_gurmukhi: string;
  medium_option_b_romanised: string | null;
  medium_option_b_english: string;
  medium_option_c_gurmukhi: string;
  medium_option_c_romanised: string | null;
  medium_option_c_english: string;
  medium_option_d_gurmukhi: string;
  medium_option_d_romanised: string | null;
  medium_option_d_english: string;
  hard_word_tiles: ConversationHardWordTile[];
};

export type ConversationExchangeResult = {
  exchange_id: string;
  sequence_order: number;
  correct: boolean;
};

export type ConversationPracticeMetadata = {
  accuracy: number;
  correct: number;
  total: number;
  character_id: string;
  scenario_id: string;
  difficulty: ConversationDifficulty;
  exchanges: ConversationExchangeResult[];
};

export type ConversationPracticeContent = {
  characters: ConversationCharacter[];
  scenarios: ConversationScenario[];
  exchangesByScenario: Record<string, ConversationExchange[]>;
  /** Approved NPC line audio keyed by `${scenarioId}:${gurmukhi}` (legacy turn fallback). */
  npcAudioByKey: Record<string, string>;
  /** Approved exchange audio keyed by exchange id. */
  exchangeAudioById: ExchangeAudioById;
  tableReady: boolean;
  loadError: string | null;
};
