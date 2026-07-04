import type { BattleGameSource } from "@/lib/battle/constants";

export type BattleSessionStatus = "waiting" | "active" | "completed" | "abandoned";

export type GenderSortQuestionPayload = {
  type: "gender_sort";
  nounId: string;
  punjabiWord: string;
  englishMeaning: string;
  romanised: string | null;
  correctAnswer: "masculine" | "feminine";
};

export type ConjugationOption = {
  gurmukhi: string;
  romanised: string;
};

export type ConjugationChallengeQuestionPayload = {
  type: "conjugation_challenge";
  sentenceId: string;
  prompt: string;
  englishGloss: string;
  options: ConjugationOption[];
  correctAnswer: string;
};

export type BattleQuestionPayload =
  | GenderSortQuestionPayload
  | ConjugationChallengeQuestionPayload;

export type BattleSessionRow = {
  id: string;
  player_one_id: string;
  player_two_id: string | null;
  invite_code: string;
  status: BattleSessionStatus;
  game_source: BattleGameSource;
  player_one_hp: number;
  player_two_hp: number;
  current_round: number;
  winner_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type BattleRoundRow = {
  id: string;
  session_id: string;
  round_number: number;
  question_payload: BattleQuestionPayload;
  round_started_at: string;
  player_one_answer: string | null;
  player_one_answered_at: string | null;
  player_one_correct: boolean | null;
  player_two_answer: string | null;
  player_two_answered_at: string | null;
  player_two_correct: boolean | null;
  player_one_damage_dealt: number;
  player_two_damage_dealt: number;
  round_multiplier: number;
  resolved_at: string | null;
  player_one_ready_at: string | null;
  player_two_ready_at: string | null;
  /** When both players acknowledged ready; answer timer starts here. */
  round_active_at: string | null;
};

export type RoundResolutionResult = {
  playerOneDamageDealt: number;
  playerTwoDamageDealt: number;
  netDamage: number;
  damageRecipient: "player_one" | "player_two" | null;
  finalDamage: number;
  playerOneHp: number;
  playerTwoHp: number;
  winnerId: string | null;
  sessionCompleted: boolean;
};
