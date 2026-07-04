import type { ConversationExchange } from "./types";
import type { TranscriptEntry } from "@/components/conversation/conversation-transcript";

export function isSameTranscriptLine(a: TranscriptEntry, b: TranscriptEntry): boolean {
  return (
    a.role === b.role &&
    a.gurmukhi.trim() === b.gurmukhi.trim() &&
    (a.romanised?.trim() ?? "") === (b.romanised?.trim() ?? "")
  );
}

/** Append only if this id is new and the line isn't a back-to-back duplicate. */
export function appendTranscriptEntry(
  prev: TranscriptEntry[],
  entry: TranscriptEntry
): TranscriptEntry[] {
  if (prev.some((existing) => existing.id === entry.id)) return prev;

  const last = prev[prev.length - 1];
  if (last && isSameTranscriptLine(last, entry)) return prev;

  return [...prev, entry];
}

export function npcSetupEntry(
  exchange: ConversationExchange,
  audioUrl?: string | null
): TranscriptEntry {
  return {
    id: `npc-setup-${exchange.id}`,
    role: "npc",
    gurmukhi: exchange.npc_setup_gurmukhi,
    romanised: exchange.npc_setup_romanised,
    english: exchange.npc_setup_english,
    audioUrl: audioUrl ?? null,
  };
}

export function npcReplyEntry(
  exchange: ConversationExchange,
  audioUrl?: string | null
): TranscriptEntry | null {
  const gurmukhi = exchange.npc_reply_gurmukhi?.trim();
  const english = exchange.npc_reply_english?.trim();
  if (!gurmukhi && !english) return null;

  return {
    id: `npc-reply-${exchange.id}`,
    role: "npc",
    gurmukhi: gurmukhi ?? "",
    romanised: exchange.npc_reply_romanised,
    english: exchange.npc_reply_english,
    audioUrl: audioUrl ?? null,
  };
}

/**
 * Student line in the transcript always uses the canonical target_response so the
 * thread reads as a coherent scripted dialogue ( wrong picks are surfaced in the
 * pinned feedback panel, not in the chat history).
 */
export function studentAnswerEntry(
  exchange: ConversationExchange,
  audioUrl?: string | null
): TranscriptEntry {
  return {
    id: `student-${exchange.id}`,
    role: "student",
    gurmukhi: exchange.target_response_gurmukhi,
    romanised: exchange.target_response_romanised,
    english: exchange.target_response_english,
    audioUrl: audioUrl ?? null,
  };
}
