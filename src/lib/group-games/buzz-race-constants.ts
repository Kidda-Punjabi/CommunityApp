/** Shared buzz-race timing — used by Buzz-in and Jeopardy (server RPCs use matching intervals). */
export const BUZZ_RACE_BUZZ_WINDOW_MS = 12_000;
/** Matches v_answer_window in the buzz-in and jeopardy timeout RPCs (supabase/buzz-race-answer-window.sql). */
export const BUZZ_RACE_ANSWER_WINDOW_MS = 15_000;
export const BUZZ_RACE_RESULT_DELAY_MS = 2_800;
