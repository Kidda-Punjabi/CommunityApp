import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";

function utcCalendarDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** Strip a leading "Kidda - " prefix so Learn shows "Kids Circle 1". */
export function displayKidsCohortName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const trimmed = name.trim();
  const stripped = trimmed.replace(/^Kidda\s*[-–—]\s*/i, "").trim();
  return stripped || trimmed;
}

export function formatKidsCohortOpenDate(startDate: string): string {
  const day = utcCalendarDay(startDate);
  if (!day) return startDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

export function shortKidsCohortStartStatus(startDate: string): string {
  const day = utcCalendarDay(startDate);
  if (!day) return "Starts soon";
  const label = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
  return `Starts ${label}`;
}

function weekdayPlural(
  startDayOfWeek: string | null,
  weeklySessionStart: string | null
): string | null {
  const fromIso = weeklySessionStart
    ? new Date(weeklySessionStart).toLocaleDateString("en-GB", {
        weekday: "long",
        timeZone: UK_DISPLAY_TIMEZONE,
      })
    : null;
  const raw = (fromIso || startDayOfWeek || "").trim();
  if (!raw) return null;
  const titled = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return titled.endsWith("s") ? titled : `${titled}s`;
}

function timeRangeUk(
  weeklySessionStart: string | null,
  weeklySessionEnd: string | null,
  hasTime: boolean
): string | null {
  if (!hasTime || !weeklySessionStart) return null;
  const start = new Date(weeklySessionStart);
  if (Number.isNaN(start.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: UK_DISPLAY_TIMEZONE,
  };
  const startLabel = start.toLocaleTimeString("en-GB", opts);
  if (!weeklySessionEnd) return startLabel;
  const end = new Date(weeklySessionEnd);
  if (Number.isNaN(end.getTime())) return startLabel;
  return `${startLabel}–${end.toLocaleTimeString("en-GB", opts)}`;
}

export function formatKidsCohortWeeklyLabel(params: {
  startDayOfWeek: string | null;
  weeklySessionStart: string | null;
  weeklySessionEnd: string | null;
  weeklySessionHasTime: boolean;
}): string | null {
  const day = weekdayPlural(params.startDayOfWeek, params.weeklySessionStart);
  const time = timeRangeUk(
    params.weeklySessionStart,
    params.weeklySessionEnd,
    params.weeklySessionHasTime
  );
  if (day && time) return `${day}, ${time}`;
  if (day) return day;
  if (time) return time;
  return null;
}

export function kidsCourseHubStatus(params: {
  cohortName: string | null;
  startDate: string | null;
  gated: boolean;
}): string {
  const name = displayKidsCohortName(params.cohortName);
  if (params.gated && params.startDate) {
    const starts = shortKidsCohortStartStatus(params.startDate);
    return name ? `${name} · ${starts}` : starts;
  }
  return name ?? "Your class";
}

export function isKidsCohortStartInFuture(
  startDate: string | null | undefined,
  now: Date = new Date()
): boolean {
  const start = utcCalendarDay(startDate);
  const today = utcCalendarDay(now.toISOString());
  if (!start || !today) return false;
  return start > today;
}
