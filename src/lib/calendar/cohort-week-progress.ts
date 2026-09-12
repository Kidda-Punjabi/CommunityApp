import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";
import type { LearnTrackId } from "@/lib/learning/learn-catalog";

export const SWITCH_COHORT_TRACKS = ["beginners", "foundational"] as const;
export type SwitchCohortTrackId = (typeof SWITCH_COHORT_TRACKS)[number];

export const SWITCH_COHORT_SUCCESS_COPY =
  "Request sent. The Kidda team will review it — a £50 switching fee applies once your new cohort is confirmed.";

export const SWITCH_COHORT_FEE_FOOTER =
  "A £50 switching fee applies once your new cohort is confirmed.";

export function isSwitchCohortTrack(trackId: string): trackId is SwitchCohortTrackId {
  return (SWITCH_COHORT_TRACKS as readonly string[]).includes(trackId);
}

export function switchCohortPath(trackId: LearnTrackId | SwitchCohortTrackId): string {
  return `/dashboard/learn/${trackId}/switch-cohort`;
}

export function calendarDayUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** e.g. "27 August 2026" from a timestamptz or YYYY-MM-DD start_date. */
export function formatCohortStartDate(value: string | null | undefined): string | null {
  const day = calendarDayUtc(value);
  if (!day) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

export function formatCohortSessionDayTime(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return startsAt;

  const weekday = start.toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
  const startTime = start.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
  if (Number.isNaN(end.getTime())) return `${weekday}, ${startTime}`;
  const endTime = end.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
  return `${weekday}, ${startTime} – ${endTime}`;
}

export function formatCohortSessionDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
}

export function cohortHasStarted(
  startDateIso: string | null | undefined,
  weekNumber: number | null | undefined,
  nowMs = Date.now()
): boolean {
  const startDay = calendarDayUtc(startDateIso);
  const today = calendarDayUtc(new Date(nowMs).toISOString());
  if (startDay && today) return startDay <= today;
  return (weekNumber ?? 1) > 1;
}

/**
 * Current curriculum week from stored week_number on the next upcoming session.
 * Does not fall back to completed-log + index labelling.
 */
export function currentWeekFromStoredWeekNumber(
  sessions: Array<{ starts_at: string; week_number?: number | null; status?: string | null }>,
  nowMs = Date.now()
): { week: number; runsAt: string } | null {
  const upcoming = sessions
    .filter((session) => session.status !== "cancelled")
    .filter((session) => session.week_number != null)
    .filter((session) => new Date(session.starts_at).getTime() >= nowMs)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.week_number! - b.week_number!);

  const next = upcoming[0];
  if (!next || next.week_number == null) return null;
  return { week: next.week_number, runsAt: next.starts_at };
}

export function resolveCohortProgressCurrentWeek(params: {
  startDateIso: string | null | undefined;
  storedWeek: number | null | undefined;
  nowMs?: number;
}): number | null {
  if (params.storedWeek != null) return params.storedWeek;
  return cohortHasStarted(params.startDateIso, params.storedWeek, params.nowMs) ? null : 1;
}

/**
 * Current week for parent kid-progress cards when stored week_number is often null.
 * Prefer the next upcoming session's week_number; else elapsed scheduled sessions;
 * else week 1 if the cohort has not started (never a hardcoded 0 for an enrolled kid).
 */
export function deriveCohortCurrentWeek(params: {
  startDateIso: string | null | undefined;
  totalWeeks: number;
  sessions: Array<{ starts_at: string; week_number?: number | null; status?: string | null }>;
  nowMs?: number;
}): number {
  const nowMs = params.nowMs ?? Date.now();
  const cap = Math.max(params.totalWeeks, 1);
  const stored = currentWeekFromStoredWeekNumber(params.sessions, nowMs)?.week ?? null;
  if (stored != null) return Math.min(stored, cap);

  const resolved = resolveCohortProgressCurrentWeek({
    startDateIso: params.startDateIso,
    storedWeek: stored,
    nowMs,
  });
  if (resolved != null) return Math.min(resolved, cap);

  const elapsed = params.sessions.filter(
    (session) =>
      session.status !== "cancelled" && new Date(session.starts_at).getTime() <= nowMs
  ).length;
  if (elapsed <= 0) return 1;
  return Math.min(elapsed, cap);
}

export function formatStartedWeekProgressLine(params: {
  startDateIso: string | null | undefined;
  currentWeek: number | null | undefined;
  totalWeeks: number;
}): string | null {
  const started = formatCohortStartDate(params.startDateIso);
  const week =
    params.currentWeek != null && params.totalWeeks > 0
      ? `Week ${params.currentWeek} of ${params.totalWeeks}`
      : null;
  const parts = [started ? `Started ${started}` : null, week].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatAlternateCohortStatus(params: {
  hasStarted: boolean;
  currentWeek: number | null;
  totalWeeks: number;
  weekRunsAt: string | null;
  startDateIso: string | null;
}): string | null {
  if (!params.hasStarted) {
    const date =
      formatCohortStartDate(params.startDateIso) ?? formatCohortSessionDate(params.weekRunsAt);
    return date ? `Starts week 1 on ${date}` : "Starts week 1 soon";
  }

  const week = params.currentWeek;
  const total = params.totalWeeks;
  const runs = formatCohortSessionDate(params.weekRunsAt);
  if (week == null || total <= 0) return runs ? `Next class ${runs}` : null;
  const weekPart = `Currently week ${week} of ${total}`;
  return runs ? `${weekPart} · week ${week} runs ${runs}` : weekPart;
}

export function pickSwitchCohortOptions<T extends { hasStarted: boolean }>(
  options: T[],
  limit = 2
): T[] {
  return [...options]
    .sort((a, b) => Number(a.hasStarted) - Number(b.hasStarted))
    .slice(0, limit);
}
