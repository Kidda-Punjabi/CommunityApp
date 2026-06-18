export type RecurrenceFreq = "weekly" | "biweekly" | "monthly";

export type StoredEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  meeting_url: string | null;
  external_url: string | null;
  required_tier: string | null;
  is_free: boolean;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_until: string | null;
};

export type DisplayEvent = StoredEvent & {
  occurrenceId: string;
};

const MAX_OCCURRENCES = 100;

function eventDurationMs(event: StoredEvent) {
  if (!event.ends_at) return 0;
  return new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime();
}

function advanceOccurrence(date: Date, freq: RecurrenceFreq) {
  const next = new Date(date);
  if (freq === "weekly") {
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (freq === "biweekly") {
    next.setDate(next.getDate() + 14);
    return next;
  }

  const day = next.getDate();
  next.setMonth(next.getMonth() + 1);
  if (next.getDate() !== day) {
    next.setDate(0);
  }
  return next;
}

function expandRecurring(
  event: StoredEvent,
  windowStart: Date,
  windowEnd: Date
): DisplayEvent[] {
  if (!event.recurrence_freq) return [];

  const occurrences: DisplayEvent[] = [];
  const until = event.recurrence_until
    ? new Date(event.recurrence_until)
    : windowEnd;
  const duration = eventDurationMs(event);

  let current = new Date(event.starts_at);
  let count = 0;

  while (current <= until && current <= windowEnd && count < MAX_OCCURRENCES) {
    const occurrenceEnd = new Date(current.getTime() + duration);
    if (occurrenceEnd >= windowStart) {
      occurrences.push({
        ...event,
        occurrenceId: `${event.id}-${current.toISOString()}`,
        starts_at: current.toISOString(),
        ends_at: duration ? new Date(current.getTime() + duration).toISOString() : null,
      });
    }
    current = advanceOccurrence(current, event.recurrence_freq);
    count += 1;
  }

  return occurrences;
}

function asDisplayEvent(event: StoredEvent): DisplayEvent {
  return {
    ...event,
    occurrenceId: event.id,
  };
}

export function expandEventOccurrences(
  event: StoredEvent,
  windowStart: Date,
  windowEnd: Date
): DisplayEvent[] {
  if (!event.recurrence_freq) {
    const end = new Date(event.ends_at ?? event.starts_at);
    const start = new Date(event.starts_at);
    if (end < windowStart || start > windowEnd) return [];
    return [asDisplayEvent(event)];
  }

  return expandRecurring(event, windowStart, windowEnd);
}

export function splitExpandedEvents(events: StoredEvent[], now = new Date()) {
  const upcomingWindowEnd = new Date(now);
  upcomingWindowEnd.setDate(upcomingWindowEnd.getDate() + 90);

  const pastWindowStart = new Date(now);
  pastWindowStart.setDate(pastWindowStart.getDate() - 60);

  const upcoming: DisplayEvent[] = [];
  const past: DisplayEvent[] = [];

  for (const event of events) {
    for (const occurrence of expandEventOccurrences(event, now, upcomingWindowEnd)) {
      const end = new Date(occurrence.ends_at ?? occurrence.starts_at);
      if (end >= now) upcoming.push(occurrence);
    }

    for (const occurrence of expandEventOccurrences(event, pastWindowStart, now)) {
      const end = new Date(occurrence.ends_at ?? occurrence.starts_at);
      if (end < now) past.push(occurrence);
    }
  }

  upcoming.sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
  past.sort(
    (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
  );

  return { upcoming, past };
}

export function formatRecurrenceLabel(
  freq: RecurrenceFreq | null,
  until: string | null
): string | null {
  if (!freq) return null;

  const labels: Record<RecurrenceFreq, string> = {
    weekly: "Repeats weekly",
    biweekly: "Repeats every 2 weeks",
    monthly: "Repeats monthly",
  };

  if (!until) return labels[freq];

  const untilDate = new Date(until).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${labels[freq]} until ${untilDate}`;
}

export const recurrenceOptions = [
  { value: "", label: "Does not repeat" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
] as const;
