export const GROUP_COHORT_SESSION_COUNT = 12;

/** How far past the intended start date to list series occurrences (allows bank-holiday skips). */
export const GROUP_COHORT_OCCURRENCE_LOOKAHEAD_WEEKS = 24;

export type GroupCohortOccurrenceDraft = {
  googleEventId: string;
  recurringEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetLink: string | null;
  location: string | null;
  attendeeEmails: string[];
  status: string;
  included: boolean;
};

export type GroupCohortOccurrenceWithWeek = GroupCohortOccurrenceDraft & {
  weekNumber: number | null;
};

export function defaultIncludeOccurrence(status: string | undefined, includedSoFar: number): boolean {
  if ((status ?? "confirmed") === "cancelled") return false;
  return includedSoFar < GROUP_COHORT_SESSION_COUNT;
}

export function withAssignedWeekNumbers<T extends { included: boolean }>(
  items: T[]
): Array<T & { weekNumber: number | null }> {
  let week = 0;
  return items.map((item) => {
    if (!item.included) return { ...item, weekNumber: null };
    week += 1;
    return { ...item, weekNumber: week };
  });
}

export function includedOccurrenceCount(items: { included: boolean }[]): number {
  return items.filter((item) => item.included).length;
}

export function hasExactLinkedSessionCount(items: { included: boolean }[]): boolean {
  return includedOccurrenceCount(items) === GROUP_COHORT_SESSION_COUNT;
}

export function occurrenceOnOrAfterDate(startsAt: string, dateInput: string): boolean {
  if (!dateInput) return true;
  const ukDate = new Date(startsAt).toLocaleDateString("en-CA", {
    timeZone: "Europe/London",
  });
  return ukDate >= dateInput;
}
