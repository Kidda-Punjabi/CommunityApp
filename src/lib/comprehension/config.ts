export const COMPREHENSION_PRACTICE_DISPLAY_NAME = "Comprehension Practice";

export const COMPREHENSION_PRACTICE_GAME_TYPE = "comprehension_practice" as const;

export const COMPREHENSION_MODES = ["reading", "listening", "both"] as const;

export type ComprehensionMode = (typeof COMPREHENSION_MODES)[number];

export const COMPREHENSION_MODE_LABELS: Record<ComprehensionMode, string> = {
  reading: "Reading",
  listening: "Listening",
  both: "Both",
};

export const COMPREHENSION_MODE_DESCRIPTIONS: Record<ComprehensionMode, string> = {
  reading: "Read the script in Gurmukhi and romanised text",
  listening: "Listen to each sentence — reveal text when you need it",
  both: "Read and listen together",
};

export const COMPREHENSION_AUDIO_BUCKET = "comprehension-audio" as const;

export const PLAY_ALL_PAUSE_MS = 600;
