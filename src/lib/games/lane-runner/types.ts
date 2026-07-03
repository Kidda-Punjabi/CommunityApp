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

export type ActiveCoin = {
  id: string;
  targetLane: LaneIndex;
  status: "falling" | "holding" | "caught" | "missed";
};
