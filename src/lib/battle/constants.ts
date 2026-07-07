export const BATTLE_STARTING_HP = 150;
export const BATTLE_ROUND_TIMEOUT_MS = 15_000;
/** Grace period before treating opponent as disconnected (allows refresh/rejoin). */
export const BATTLE_DISCONNECT_MS = 90_000;
/** Show "reconnecting" after this many ms without opponent presence. */
export const BATTLE_RECONNECTING_MS = 5_000;
export const BATTLE_GET_READY_MS = 2500;
export const BATTLE_INVITE_CODE_LENGTH = 6;

export const BATTLE_GAME_SOURCES = ["gender_sort", "conjugation_challenge"] as const;
export type BattleGameSource = (typeof BATTLE_GAME_SOURCES)[number];

export const BATTLE_QUICK_MATCH_WAIT_MS = 10_000;
