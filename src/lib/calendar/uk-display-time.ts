/** British civil time for admin calendar display (GMT in winter, BST in summer). */
export const UK_DISPLAY_TIMEZONE = "Europe/London";

export function minutesOfDayInTimezone(iso: string, timeZone: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

export function weekdayNameInTimezone(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone,
  });
}

export function ukTimeZoneAbbreviation(iso: string): string {
  const label = new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: UK_DISPLAY_TIMEZONE,
    timeZoneName: "short",
  });
  const match = label.match(/\b(GMT|BST)\b/);
  return match?.[1] ?? "UK";
}

/** e.g. "Mon, 7:00 pm – 8:30 pm BST" */
export function formatSessionTimeRangeUk(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startsAt} – ${endsAt}`;
  }

  const tz = UK_DISPLAY_TIMEZONE;
  const startLabel = start.toLocaleString("en-GB", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const endLabel = end.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const zone = ukTimeZoneAbbreviation(startsAt);
  return `${startLabel} – ${endLabel} ${zone}`;
}

export function formatSessionWhenUk(startsAt: string): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  const tz = UK_DISPLAY_TIMEZONE;
  const when = start.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  return `${when} ${ukTimeZoneAbbreviation(startsAt)}`;
}
