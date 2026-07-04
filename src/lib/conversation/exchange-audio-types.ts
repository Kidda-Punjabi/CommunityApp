import type { AudioContentType } from "@/lib/audio/types";

/** Audio slots keyed to a legacy `conversation_exchanges` row. */
export type ConversationExchangeAudioSlot = "npc_setup" | "npc_reply" | "player_response";

export const CONVERSATION_EXCHANGE_AUDIO_TYPES = {
  npc_setup: "conversation_exchange_npc_setup",
  npc_reply: "conversation_exchange_npc_reply",
  player_response: "conversation_exchange_player_response",
} as const satisfies Record<ConversationExchangeAudioSlot, AudioContentType>;

export type ExchangeAudioById = Record<
  string,
  {
    npcSetup: string | null;
    npcReply: string | null;
    playerResponse: string | null;
  }
>;

export function emptyExchangeAudioMap(): ExchangeAudioById[string] {
  return { npcSetup: null, npcReply: null, playerResponse: null };
}

export function exchangeAudioContentType(
  slot: ConversationExchangeAudioSlot
): AudioContentType {
  return CONVERSATION_EXCHANGE_AUDIO_TYPES[slot];
}
