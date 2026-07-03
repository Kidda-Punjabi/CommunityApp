/** Shared MCQ question shape used by Buzz-in and Jeopardy. */
export type McqQuestionPayload = {
  flashcard_id: string;
  prompt: string;
  correct_answer: string;
  options: string[];
};

export type BuzzRacePhase = "open" | "buzzed" | "result" | "waiting" | "finished";

export type BuzzRaceItemState = {
  id: string;
  opened_at: string | null;
  buzzed_by: string | null;
  buzzed_at: string | null;
  answer_correct: boolean | null;
  resolved_at: string | null;
  question_payload: McqQuestionPayload | null;
};

export function deriveBuzzRacePhase(
  item: BuzzRaceItemState | null,
  roomStatus: string
): BuzzRacePhase {
  if (roomStatus === "completed") return "finished";
  if (!item || !item.opened_at) return "waiting";
  if (item.resolved_at) return "result";
  if (item.buzzed_by) return "buzzed";
  return "open";
}
