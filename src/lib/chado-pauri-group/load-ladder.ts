import type { SupabaseClient } from "@supabase/supabase-js";
import { loadChadoPauriFlashcards } from "@/lib/games/chado-pauri/load-flashcards";
import { buildLadderQuestion } from "@/lib/chado-pauri-group/ladder-questions";
import type {
  LadderGameState,
  LadderQuestionRow,
  LadderRunRow,
} from "@/lib/chado-pauri-group/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";

export async function loadLadderRuns(
  supabase: SupabaseClient,
  roomId: string
): Promise<LadderRunRow[]> {
  const { data, error } = await supabase
    .from("game_room_ladder_runs")
    .select("*")
    .eq("room_id", roomId)
    .order("turn_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LadderRunRow[];
}

export async function loadLadderQuestionsForRun(
  supabase: SupabaseClient,
  runId: string
): Promise<LadderQuestionRow[]> {
  const { data, error } = await supabase
    .from("game_room_ladder_questions")
    .select("*")
    .eq("run_id", runId)
    .order("rung", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LadderQuestionRow[];
}

export async function loadActiveLadderQuestion(
  supabase: SupabaseClient,
  runId: string
): Promise<LadderQuestionRow | null> {
  const { data, error } = await supabase
    .from("game_room_ladder_questions")
    .select("*")
    .eq("run_id", runId)
    .is("resolved_at", null)
    .order("rung", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as LadderQuestionRow | null) ?? null;
}

export async function ensureLadderInitialized(
  supabase: SupabaseClient,
  room: GameRoomRow
): Promise<void> {
  if (room.game_type !== "chado_pauri_group" || room.status !== "in_progress") return;

  const existing = await loadLadderRuns(supabase, room.id);
  if (existing.length > 0) return;

  const { cards, loadError } = await loadChadoPauriFlashcards(supabase);
  if (loadError) throw new Error(loadError);
  if (cards.length < 4) {
    throw new Error("Not enough flashcards to start Chado Pauri group (need at least 4).");
  }

  const firstQuestion = buildLadderQuestion(cards, 0);
  if (!firstQuestion) {
    throw new Error("Could not build the first ladder question.");
  }

  const { error } = await supabase.rpc("ladder_initialize_game", {
    p_room_id: room.id,
    p_first_question: firstQuestion,
  });

  if (error) throw error;
}

export async function addLadderQuestionIfNeeded(
  supabase: SupabaseClient,
  runId: string,
  rung: number
): Promise<void> {
  const existing = await loadLadderQuestionsForRun(supabase, runId);
  if (existing.some((q) => q.rung === rung && !q.resolved_at)) return;
  if (existing.some((q) => q.rung === rung)) return;

  const { cards, loadError } = await loadChadoPauriFlashcards(supabase);
  if (loadError) throw new Error(loadError);

  const usedIds = new Set(
    existing.map((q) => q.question_payload.flashcard_id).filter(Boolean)
  );
  const question = buildLadderQuestion(cards, rung - 1, usedIds);
  if (!question) throw new Error(`Could not build question for rung ${rung}.`);

  const { error } = await supabase.rpc("ladder_add_question", {
    p_run_id: runId,
    p_rung: rung,
    p_question: question,
  });

  if (error) throw error;
}

export async function loadLadderGameState(
  supabase: SupabaseClient,
  room: GameRoomRow,
  currentUserId: string
): Promise<LadderGameState | null> {
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

  const runs = await loadLadderRuns(supabase, room.id);
  const activeRun = runs.find((r) => r.status === "active") ?? null;
  const currentQuestion = activeRun
    ? await loadActiveLadderQuestion(supabase, activeRun.id)
    : null;

  return {
    roomId: room.id,
    runs,
    activeRun,
    currentQuestion,
    scoreboard: (participantRows ?? []).map((p) => ({
      userId: p.user_id,
      displayName: profileMap.get(p.user_id) ?? "Player",
      score: p.score,
      isPlaying: p.is_playing,
      isHost: p.is_host,
    })),
    roomStatus: room.status as LadderGameState["roomStatus"],
    currentUserId,
    isPlaying: self?.is_playing ?? false,
  };
}
