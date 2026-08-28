import type { ScheduledSessionRow } from "@/lib/calendar/types";
import {
  KIDDA_CLASS_TITLE_NEEDLE,
  SESSION_SWITCH_OUTER_CAP_DAYS,
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

export type SessionSwitchNeighborBounds = {
  previousStartsAt: string | null;
  nextStartsAt: string | null;
};

export type SessionSwitchCandidateOptions = {
  nowMs?: number;
} & SessionSwitchNeighborBounds;

export type SessionSwitchSource = Pick<
  ScheduledSessionRow,
  "id" | "course_id" | "cohort_id" | "starts_at" | "week_number"
> & { lessonNumber?: number | null };

export type SessionSwitchCandidate = Pick<
  ScheduledSessionRow,
  "id" | "course_id" | "cohort_id" | "status" | "starts_at" | "title" | "week_number"
>;

type NeighborRow = Pick<
  ScheduledSessionRow,
  "id" | "course_id" | "cohort_id" | "week_number" | "starts_at" | "title"
>;

/** Inclusive ±N day outer cap around the source session's own starts_at (not today). */
export function sessionSwitchOuterCapMs(referenceStartsAt: string): { startMs: number; endMs: number } {
  const refMs = new Date(referenceStartsAt).getTime();
  const windowMs = SESSION_SWITCH_OUTER_CAP_DAYS * 24 * 60 * 60 * 1000;
  return { startMs: refMs - windowMs, endMs: refMs + windowMs };
}

/** @deprecated Use sessionSwitchOuterCapMs. */
export function sessionSwitchWindowMs(referenceStartsAt: string): { startMs: number; endMs: number } {
  return sessionSwitchOuterCapMs(referenceStartsAt);
}

/** Prefer stored curriculum week; fall back to labelled lesson number. */
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

function pickStartsAt(rows: NeighborRow[], mode: "min" | "max"): string | null {
  const times = rows
    .map((row) => new Date(row.starts_at).getTime())
    .filter((ms) => Number.isFinite(ms));
  if (times.length === 0) return null;
  const ms = mode === "min" ? Math.min(...times) : Math.max(...times);
  return new Date(ms).toISOString();
}

/**
 * Previous/next Kidda Class in the student's own cohort at week_number ± 1.
 * Missing either side is valid (first or last week). If duplicates exist, previous
 * uses the latest start and next uses the earliest start (tightest sequence window).
 */
export function resolveOwnCohortNeighborBounds(
  source: SessionSwitchSource,
  neighborRows: NeighborRow[]
): SessionSwitchNeighborBounds {
  const sourceWeek = resolveCohortSwitchWeekNumber(source);
  if (sourceWeek == null || !source.cohort_id || !source.course_id) {
    return { previousStartsAt: null, nextStartsAt: null };
  }

  const ownClassRows = neighborRows.filter(
    (row) =>
      row.id !== source.id &&
      row.cohort_id === source.cohort_id &&
      row.course_id === source.course_id &&
      isKiddaClassSessionTitle(row.title)
  );

  return {
    previousStartsAt: pickStartsAt(
      ownClassRows.filter((row) => row.week_number === sourceWeek - 1),
      "max"
    ),
    nextStartsAt: pickStartsAt(
      ownClassRows.filter((row) => row.week_number === sourceWeek + 1),
      "min"
    ),
  };
}

/**
 * One-off session switch candidate: same course, different cohort, Kidda Class title,
 * scheduled, same curriculum week_number, strictly between the student's own previous
 * and next class (when those exist), and within the ±14 day outer cap around the
 * source session's own starts_at (not today). week_number is content-equivalence.
 */
export function isSessionSwitchCandidate(
  source: SessionSwitchSource,
  candidate: SessionSwitchCandidate,
  options: SessionSwitchCandidateOptions
): boolean {
  const nowMs = options.nowMs ?? Date.now();
  if (!source.cohort_id || !source.course_id || !candidate.cohort_id || !candidate.course_id) {
    return false;
  }
  if (candidate.id === source.id) return false;
  if (candidate.cohort_id === source.cohort_id) return false;
  if (candidate.course_id !== source.course_id) return false;
  if (candidate.status !== "scheduled") return false;
  if (!isKiddaClassSessionTitle(candidate.title)) return false;

  const sourceWeek = resolveCohortSwitchWeekNumber(source);
  const candidateWeek = candidate.week_number ?? null;
  if (sourceWeek == null || candidateWeek == null) return false;
  if (sourceWeek !== candidateWeek) return false;

  const candidateMs = new Date(candidate.starts_at).getTime();
  if (Number.isNaN(candidateMs)) return false;
  if (candidateMs < nowMs) return false;

  const { startMs, endMs } = sessionSwitchOuterCapMs(source.starts_at);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;
  if (candidateMs < startMs || candidateMs > endMs) return false;

  if (options.previousStartsAt) {
    const previousMs = new Date(options.previousStartsAt).getTime();
    if (!Number.isNaN(previousMs) && candidateMs <= previousMs) return false;
  }
  if (options.nextStartsAt) {
    const nextMs = new Date(options.nextStartsAt).getTime();
    if (!Number.isNaN(nextMs) && candidateMs >= nextMs) return false;
  }

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
  source: SessionSwitchSource,
  candidate: SessionSwitchCandidate,
  options: SessionSwitchCandidateOptions
): boolean {
  return isSessionSwitchCandidate(source, candidate, options);
}
