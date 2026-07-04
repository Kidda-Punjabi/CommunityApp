import type { ConversationExchange } from "./types";
import type { ExchangeAudioById } from "./exchange-audio-types";
import { lookupNpcAudio } from "./audio-lookup";

export function resolveExchangeNpcSetupAudio(
  exchange: ConversationExchange,
  exchangeAudioById: ExchangeAudioById,
  npcAudioByKey: Record<string, string>
): string | null {
  const fromExchange = exchangeAudioById[exchange.id]?.npcSetup;
  if (fromExchange?.trim()) return fromExchange;
  return lookupNpcAudio(npcAudioByKey, exchange.scenario_id, exchange.npc_setup_gurmukhi);
}

export function resolveExchangeNpcReplyAudio(
  exchange: ConversationExchange,
  exchangeAudioById: ExchangeAudioById,
  npcAudioByKey: Record<string, string>
): string | null {
  const gurmukhi = exchange.npc_reply_gurmukhi?.trim();
  if (!gurmukhi) return null;

  const fromExchange = exchangeAudioById[exchange.id]?.npcReply;
  if (fromExchange?.trim()) return fromExchange;
  return lookupNpcAudio(npcAudioByKey, exchange.scenario_id, gurmukhi);
}

export function resolveExchangePlayerResponseAudio(
  exchange: ConversationExchange,
  exchangeAudioById: ExchangeAudioById
): string | null {
  const url = exchangeAudioById[exchange.id]?.playerResponse;
  return url?.trim() ? url : null;
}
