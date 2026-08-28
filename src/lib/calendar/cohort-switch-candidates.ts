import type { ScheduledSessionRow } from "@/lib/calendar/types";
import {
  KIDDA_CLASS_TITLE_NEEDLE,
  SESSION_SWITCH_WINDOW_DAYS,
} from "@/lib/calendar/constants";

/** Cohort lifecycle statuses that can still accept a one-off session switch. */
export const ACTIVE_COHORT_SWITCH_STATUSES = [
  "pre_scheduling",
  "recruiting",
  "scheduled",
  "in_progress",
  "paused",
] as const;

export type ActiveCohortSwitchStatus = (typeof ACTIVE_COHORT_SWITCH_STATUSES)[number];

export function isActiveCohortSwitchStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  return (ACTIVE_COHORT_SWITCH_STATUSES as readonly string[]).includes(status);
}

export function isKiddaClassSessionTitle(title: string | null | undefined): boolean {
  return (title ?? "").trim().toLowerCase().includes(KIDDA_CLASS_TITLE_NEEDLE);
}

export function sessionSwitchWindowMs(referenceStartsAt: string): { startMs: number; endMs: number } {
  const refMs = new Date(referenceStartsAt).getTime();
  const windowMs = SESSION_SWITCH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return { startMs: refMs - windowMs, endMs: refMs + windowMs };
}

/** Curriculum week label only — never used as a join/filter key for session switch. */
export function resolveCohortSwitchWeekNumber(
  session: Pick<ScheduledSessionRow, "week_number"> & { lessonNumber?: number | null }
): number | null {
  if (session.week_number != null) return session.week_number;
  if (session.lessonNumber != null) return session.lessonNumber;
  return null;
}

export function formatYourWeekClassLabel(
  session: Pick<ScheduledSessionRow, "week_number"> & { lessonNumber?: number | null }
): string | null {
  const week = resolveCohortSwitchWeekNumber(session);
  if (week == null) return null;
  return `Your Week ${week} class`;
}

/**
 * One-off session switch candidate: same course, different cohort, Kidda Class title,
 * scheduled, and within ±6 days of the source session's own starts_at (not today).
 * Does not match on week_number — cohorts can be offset.
 */
export function isSessionSwitchCandidate(
  source: Pick<ScheduledSessionRow, "id" | "course_id" | "cohort_id" | "starts_at">,
  candidate: Pick<
    ScheduledSessionRow,
    "id" | "course_id" | "cohort_id" | "status" | "starts_at" | "title"
  >,
  options?: { nowMs?: number }
): boolean {
  const nowMs = options?.nowMs ?? Date.now();
  if (!source.cohort_id || !source.course_id || !candidate.cohort_id || !candidate.course_id) {
    return false;
  }
  if (candidate.id === source.id) return false;
  if (candidate.cohort_id === source.cohort_id) return false;
  if (candidate.course_id !== source.course_id) return false;
  if (candidate.status !== "scheduled") return false;
  if (!isKiddaClassSessionTitle(candidate.title)) return false;

  const candidateMs = new Date(candidate.starts_at).getTime();
  if (Number.isNaN(candidateMs)) return false;
  if (candidateMs < nowMs) return false;

  const { startMs, endMs } = sessionSwitchWindowMs(source.starts_at);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;
  if (candidateMs < startMs || candidateMs > endMs) return false;

  return true;
}

/** @deprecated Use isKiddaClassSessionTitle — kept for callers that still pass attendee lists. */
export function isValidCohortSwitchCandidateSession(
  session: Pick<ScheduledSessionRow, "cohort_id" | "title">
): boolean {
  return Boolean(session.cohort_id) && isKiddaClassSessionTitle(session.title);
}

/** @deprecated Use isSessionSwitchCandidate. */
export function isAlternateCohortSwitchSession(
  source: Pick<ScheduledSessionRow, "id" | "course_id" | "cohort_id" | "starts_at">,
  candidate: Pick<
    ScheduledSessionRow,
    "id" | "course_id" | "cohort_id" | "status" | "starts_at" | "title"
  >,
  options?: { nowMs?: number }
): boolean {
  return isSessionSwitchCandidate(source, candidate, options);
}
