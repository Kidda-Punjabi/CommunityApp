"use server";

import { createClient } from "@/lib/supabase/server";
import { createNextSentenceRound } from "@/lib/sentence-builder-group/load-sentence";

export type SentenceActionResult = {
  error?: string;
  wasCorrect?: boolean;
  roundCompleted?: boolean;
  gameCompleted?: boolean;
};

type PlacementPayload = {
  was_correct?: boolean;
  round_completed?: boolean;
  game_completed?: boolean;
  next_round_number?: number;
  next_grammar_sentence_id?: string;
  next_turn_player_id?: string;
};

export async function submitTilePlacementAction(
  roomId: string,
  roundId: string,
  tileIdentifier: string
): Promise<SentenceActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_tile_placement", {
    p_round_id: roundId,
    p_tile_identifier: tileIdentifier,
  });

  if (error) return { error: error.message };

  const payload = data as PlacementPayload;

  if (
    payload.round_completed &&
    !payload.game_completed &&
    payload.next_round_number &&
    payload.next_grammar_sentence_id &&
    payload.next_turn_player_id
  ) {
    try {
      await createNextSentenceRound(
        supabase,
        roomId,
        payload.next_round_number,
        payload.next_grammar_sentence_id,
        payload.next_turn_player_id
      );
    } catch (initError) {
      const message =
        initError instanceof Error ? initError.message : "Failed to start next round.";
      return { error: message };
    }
  }

  return {
    wasCorrect: payload.was_correct,
    roundCompleted: payload.round_completed,
    gameCompleted: payload.game_completed,
  };
}
