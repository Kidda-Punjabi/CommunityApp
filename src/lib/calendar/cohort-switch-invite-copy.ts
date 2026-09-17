/** Marker used to find and replace a previous reschedule note on the same event. */
export const RESCHEDULE_INVITE_MARKER = "This is the session you've been rescheduled to";

export function formatCohortWeekLabel(
  cohortName: string | null | undefined,
  weekNumber: number | null | undefined
): string {
  const parts: string[] = [];
  const name = cohortName?.trim();
  if (name) parts.push(name);
  if (typeof weekNumber === "number" && Number.isFinite(weekNumber)) {
    parts.push(`Week ${weekNumber}`);
  }
  return parts.join(" · ");
}

export function buildRescheduleInviteNote(params: {
  cohortName?: string | null;
  weekNumber?: number | null;
  joinLink?: string | null;
}): string {
  const where = formatCohortWeekLabel(params.cohortName, params.weekNumber);
  const sessionLine = where
    ? `${RESCHEDULE_INVITE_MARKER} (${where}).`
    : `${RESCHEDULE_INVITE_MARKER}.`;
  const joinLink = params.joinLink?.trim() || null;
  if (joinLink) {
    return `${sessionLine} Use the link below to join:\n${joinLink}`;
  }
  return `${sessionLine} Use the join link on this calendar event to join the class.`;
}

export function mergeCalendarInviteDescription(
  existing: string | null | undefined,
  note: string
): string {
  const current = (existing ?? "").trim();
  const nextNote = note.trim();
  if (!current) return nextNote;
  if (!nextNote) return current;

  const markerIndex = current.indexOf(RESCHEDULE_INVITE_MARKER);
  if (markerIndex >= 0) {
    const before = current.slice(0, markerIndex).replace(/\s+$/, "");
    return before ? `${before}\n\n${nextNote}` : nextNote;
  }

  return `${current}\n\n${nextNote}`;
}
