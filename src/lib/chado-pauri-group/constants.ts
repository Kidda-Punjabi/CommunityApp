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

export function ladderHalfHalfUsed(settings: Record<string, unknown> | null | undefined): boolean {
  return settings?.ladder_half_half_used === true;
}

export function ladderAskTutorUsed(settings: Record<string, unknown> | null | undefined): boolean {
  return settings?.ladder_ask_tutor_used === true;
}

export function parseLadderTurnOrder(settings: Record<string, unknown> | null | undefined): string[] {
  const raw = settings?.ladder_turn_order;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}
