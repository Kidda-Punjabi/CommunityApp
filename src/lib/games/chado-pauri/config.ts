/** Display name — change here to rename the game everywhere in UI. */
export const CHADO_PAURI_DISPLAY_NAME = "Charo Pauri";

export const CHADO_PAURI_GAME_TYPE = "chado_pauri" as const;

export const CHADO_PAURI_RUNG_POINTS = [1, 2, 4, 8, 16, 32, 50, 75, 100] as const;

export const CHADO_PAURI_RUNG_COUNT = CHADO_PAURI_RUNG_POINTS.length;

/** Rung index (0-based) -> target flashcard difficulty tier. */
export function difficultyForRung(rungIndex: number): number {
  const rung = rungIndex + 1;
  if (rung <= 2) return 1;
  if (rung <= 4) return 2;
  if (rung <= 6) return 3;
  if (rung === 7) return 4;
  return 5;
}

export const LIFELINE_LABELS = {
  half_half: "Half & Half",
  ask_tutor: "Ask the Tutor",
  skip: "Skip",
} as const;

export type LifelineId = keyof typeof LIFELINE_LABELS;
