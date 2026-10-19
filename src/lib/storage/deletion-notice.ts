/** Calendar date in Europe/London, YYYY-MM-DD. */
export function londonDateIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Whole days from `fromIso` until `toIso`. Negative when `toIso` is earlier. */
export function daysUntil(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export type NoticePlan =
  | { action: "send14"; deleteOn: string }
  | { action: "send3"; deleteOn: string }
  | { action: "delete"; deleteOn: string }
  | { action: "wait"; deleteOn: string | null };

/**
 * 14-day email sets the deletion date. The 3-day email goes out when that date
 * is 3 days away. Deletion waits until the 3-day email is at least 3 days old.
 */
export function planDeletionNotice(input: {
  today: string;
  deleteOn: string | null;
  sent14: boolean;
  sent3On: string | null;
}): NoticePlan {
  if (!input.sent14 || !input.deleteOn) {
    return { action: "send14", deleteOn: addIsoDays(input.today, 14) };
  }

  const remaining = daysUntil(input.today, input.deleteOn);
  if (!input.sent3On && remaining <= 3) {
    return {
      action: "send3",
      deleteOn: remaining >= 3 ? input.deleteOn : addIsoDays(input.today, 3),
    };
  }

  const remindedEarlyEnough =
    input.sent3On != null && daysUntil(input.sent3On, input.today) >= 3;
  if (remaining <= 0 && remindedEarlyEnough) {
    return { action: "delete", deleteOn: input.deleteOn };
  }

  return { action: "wait", deleteOn: input.deleteOn };
}
