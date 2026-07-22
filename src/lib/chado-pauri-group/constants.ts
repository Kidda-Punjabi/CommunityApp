/** Simulated Ask the Room — max uses per game room (shared pool). */
export const LADDER_ASK_ROOM_MAX_USES_PER_GAME = 3;

export const LADDER_FEEDBACK_MS = 1_200;

export function ladderAskRoomUsesFromSettings(settings: Record<string, unknown> | null | undefined): number {
  const raw = settings?.ladder_ask_room_uses;
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

export function ladderAskRoomUsesRemaining(settings: Record<string, unknown> | null | undefined): number {
  return Math.max(0, LADDER_ASK_ROOM_MAX_USES_PER_GAME - ladderAskRoomUsesFromSettings(settings));
}
