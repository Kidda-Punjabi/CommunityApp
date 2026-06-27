export type MonthDayCell = {
  date: Date;
  inMonth: boolean;
};

export function toLocalDateKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalDateKey(iso: string): string {
  return toLocalDateKeyFromDate(new Date(iso));
}

export function groupSessionsByDate<T extends { starts_at: string }>(
  sessions: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const session of sessions) {
    const key = toLocalDateKey(session.starts_at);
    const existing = grouped.get(key) ?? [];
    existing.push(session);
    grouped.set(key, existing);
  }

  for (const [key, rows] of grouped) {
    rows.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    grouped.set(key, rows);
  }

  return grouped;
}

export function buildMonthWeeks(year: number, month: number): MonthDayCell[][] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const weeks: MonthDayCell[][] = [];
  let cursor = new Date(gridStart);

  for (let week = 0; week < 6; week += 1) {
    const days: MonthDayCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push({
        date: new Date(cursor),
        inMonth: cursor.getMonth() === month,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }

  return weeks;
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function formatDayHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const startTime = start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  return `${startTime} – ${endTime}`;
}
