export const BATTLE_STARTING_HP = 150;
export const BATTLE_ROUND_TIMEOUT_MS = 15_000;
export const BATTLE_DISCONNECT_MS = 60_000;
export const BATTLE_INVITE_CODE_LENGTH = 6;

export const BATTLE_GAME_SOURCES = ["gender_sort", "conjugation_challenge"] as const;
export type BattleGameSource = (typeof BATTLE_GAME_SOURCES)[number];
