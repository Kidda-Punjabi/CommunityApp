/** Display name — change here to rename the game everywhere in UI. */
export const CONVERSATION_PRACTICE_DISPLAY_NAME = "Conversation Practice";

export const CONVERSATION_PRACTICE_GAME_TYPE = "conversation_practice" as const;

export const CONVERSATION_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type ConversationDifficulty = (typeof CONVERSATION_DIFFICULTIES)[number];

export const CONVERSATION_DIFFICULTY_LABELS: Record<ConversationDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const CONVERSATION_DIFFICULTY_DESCRIPTIONS: Record<ConversationDifficulty, string> = {
  easy: "Fill in the missing word",
  medium: "Pick the best full reply",
  hard: "Build the reply from word tiles",
};
