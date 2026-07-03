export type LaneIndex = 0 | 1 | 2;

export type LaneRunnerFlashcard = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  category: string | null;
};

export type LaneAnswerOption = {
  gurmukhi: string;
  romanised: string;
};

export type LaneRunnerGate = {
  flashcard_id: string;
  prompt: string;
  laneAnswers: [LaneAnswerOption, LaneAnswerOption, LaneAnswerOption];
  correctLane: LaneIndex;
};

export type LaneRunnerGateResult = {
  flashcard_id: string;
  correct_lane: LaneIndex;
  selected_lane: LaneIndex;
  hit: boolean;
};

export type CollectibleStatus = "falling" | "caught" | "missed";

export type ActiveCoin = {
  id: string;
  targetLane: LaneIndex;
  status: CollectibleStatus;
  /** Ms after mount before this coin begins falling (stagger within a gate round). */
  startDelayMs: number;
};

export type ActiveLetter = {
  id: string;
  letter: string;
  targetLane: LaneIndex;
  status: CollectibleStatus;
};

export type LaneRunnerRoundSummary = {
  finalStreak: number;
  bestStreak: number;
  coinsEarnedRound: number;
  gatesAnswered: number;
  gatesCorrect: number;
};
