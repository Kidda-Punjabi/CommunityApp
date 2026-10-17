export function formatSessionClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function daysUntilLabel(iso: string, timeZone: string, now = new Date()): string {
  const start = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const days = Math.round((startMs - todayMs) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

export function canJoinSession(startsAt: string, endsAt: string, now = new Date()): boolean {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return now.getTime() >= start - 2 * 60 * 1000 && now.getTime() < end;
}

export function googleCalendarUrl(title: string, startsAt: string, endsAt: string): string {
  const stamp = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(startsAt)}/${stamp(endsAt)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function nextLocalStart(weekday: number, timeLocal: string, timeZone: string, firstStartsOn: string | null, now = new Date()): Date {
  const [hour, minute] = timeLocal.slice(0, 5).split(":").map(Number);
  const probe = new Date(now.getTime());
  for (let i = 0; i < 21; i += 1) {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(probe);
    const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(probe);
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
    if (day === weekday && (!firstStartsOn || date >= firstStartsOn)) {
      const utcGuess = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
      const shown = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(utcGuess));
      const [shownHour, shownMinute] = shown.split(":").map(Number);
      const delta = (hour * 60 + minute - (shownHour * 60 + shownMinute)) * 60 * 1000;
      const instant = new Date(utcGuess + delta);
      if (instant.getTime() > now.getTime() - 60 * 60 * 1000) return instant;
    }
    probe.setTime(probe.getTime() + 86_400_000);
  }
  return now;
}
