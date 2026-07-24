import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRoundPayload,
  pickSessionSentences,
  type GrammarSentenceRow,
} from "@/lib/sentence-builder-group/pick-sentences";
import type {
  SentenceBuilderGroupState,
  SentenceRoundRow,
} from "@/lib/sentence-builder-group/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";

export async function loadSentenceRounds(
  supabase: SupabaseClient,
  roomId: string
): Promise<SentenceRoundRow[]> {
  const { data, error } = await supabase
    .from("game_room_sentence_rounds")
    .select("*")
    .eq("room_id", roomId)
    .order("round_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SentenceRoundRow[];
}

export async function loadActiveSentenceRound(
  supabase: SupabaseClient,
  roomId: string
): Promise<SentenceRoundRow | null> {
  const { data, error } = await supabase
    .from("game_room_sentence_rounds")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "active")
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as SentenceRoundRow | null) ?? null;
}

export async function ensureSentenceBuilderInitialized(
  supabase: SupabaseClient,
  room: GameRoomRow
): Promise<void> {
  if (room.game_type !== "sentence_builder_group" || room.status !== "in_progress") return;

  const existing = await loadSentenceRounds(supabase, room.id);
  if (existing.length > 0) return;

  const questionCount =
    typeof room.settings?.question_count === "number" ? room.settings.question_count : 10;

  const { sentences, sessionSentenceIds } = await pickSessionSentences(
    supabase,
    questionCount,
    room.settings
  );
  const first = buildRoundPayload(sentences[0]!, 1);

  const { error } = await supabase.rpc("sentence_initialize_game", {
    p_room_id: room.id,
    p_grammar_sentence_id: first.grammar_sentence_id,
    p_tile_pool: first.tile_pool,
    p_session_sentence_ids: sessionSentenceIds,
    p_total_rounds: sentences.length,
  });

  if (error) throw error;
}

export async function createNextSentenceRound(
  supabase: SupabaseClient,
  roomId: string,
  roundNumber: number,
  grammarSentenceId: string,
  currentTurnPlayerId: string
): Promise<void> {
  const { data: fullSentence, error: fetchError } = await supabase
    .from("grammar_sentences")
    .select("id, punjabi_sentence, english_translation, word_tiles, difficulty")
    .eq("id", grammarSentenceId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!fullSentence) throw new Error("Grammar sentence not found for next round.");

  const payload = buildRoundPayload(fullSentence as GrammarSentenceRow, roundNumber);

  const { error } = await supabase.rpc("sentence_create_round", {
    p_room_id: roomId,
    p_round_number: roundNumber,
    p_grammar_sentence_id: payload.grammar_sentence_id,
    p_tile_pool: payload.tile_pool,
    p_current_turn_player_id: currentTurnPlayerId,
  });

  if (error) throw error;
}

/** Recover if a round completed but the next round was never created (e.g. submitter disconnected). */
export async function ensureSentenceBuilderContinued(
  supabase: SupabaseClient,
  room: GameRoomRow
): Promise<void> {
  if (room.game_type !== "sentence_builder_group" || room.status !== "in_progress") return;

  const active = await loadActiveSentenceRound(supabase, room.id);
  if (active) return;

  const rounds = await loadSentenceRounds(supabase, room.id);
  const last = rounds.at(-1);
  if (!last || last.status !== "completed") return;

  const totalRounds =
    typeof room.settings?.question_count === "number" ? room.settings.question_count : 0;
  if (last.round_number >= totalRounds) return;

  const sessionIds = room.settings?.session_sentence_ids;
  if (!Array.isArray(sessionIds) || sessionIds.length <= last.round_number) return;

  const nextSentenceId = String(sessionIds[last.round_number]);
  const nextTurnPlayerId = last.current_turn_player_id;
  if (!nextSentenceId || !nextTurnPlayerId) return;

  await createNextSentenceRound(
    supabase,
    room.id,
    last.round_number + 1,
    nextSentenceId,
    nextTurnPlayerId
  );
}

export async function loadSentenceBuilderGroupState(
  supabase: SupabaseClient,
  room: GameRoomRow,
  currentUserId: string
): Promise<SentenceBuilderGroupState | null> {
  const { data: participantRows, error: participantError } = await supabase
    .from("game_room_participants")
    .select("*")
    .eq("room_id", room.id)
    .is("left_at", null)
    .order("score", { ascending: false });

  if (participantError) throw participantError;

  const isMember = (participantRows ?? []).some((p) => p.user_id === currentUserId);
  if (!isMember) return null;

  const self = (participantRows ?? []).find((p) => p.user_id === currentUserId);

  const userIds = (participantRows ?? []).map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, getDisplayName(p) ?? "Player"])
  );

  const rounds = await loadSentenceRounds(supabase, room.id);
  const activeRound = rounds.find((r) => r.status === "active") ?? null;
  const totalRounds =
    typeof room.settings?.question_count === "number" ? room.settings.question_count : rounds.length;

  const latestCompletedRound =
    !activeRound && room.status === "in_progress"
      ? (rounds.filter((r) => r.status === "completed").at(-1) ?? null)
      : null;

  let revealedTranslation: string | null = null;
  if (latestCompletedRound) {
    const { data: sentenceRow } = await supabase
      .from("grammar_sentences")
      .select("english_translation")
      .eq("id", latestCompletedRound.grammar_sentence_id)
      .maybeSingle();
    revealedTranslation = sentenceRow?.english_translation ?? null;
  }

  return {
    roomId: room.id,
    rounds,
    activeRound,
    latestCompletedRound,
    totalRounds,
    revealedTranslation,
    scoreboard: (participantRows ?? []).map((p) => ({
      userId: p.user_id,
      displayName: profileMap.get(p.user_id) ?? "Player",
      score: p.score,
      isPlaying: p.is_playing,
      isHost: p.is_host,
    })),
    roomStatus: room.status as SentenceBuilderGroupState["roomStatus"],
    currentUserId,
    isPlaying: self?.is_playing ?? false,
  };
}
