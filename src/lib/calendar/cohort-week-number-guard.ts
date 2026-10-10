import {
  cohortAnchorTitlesByCohort,
  isCohortClassSession,
  type CohortClassSessionMatchInput,
} from "@/lib/calendar/cohort-session-week-number";
import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";

export type CohortWeekSession = {
  id: string;
  startsAt: string;
  weekNumber: number | null;
};

export type CohortWeekGap = {
  from: number;
  to: number;
  key: string;
};

export type CohortWeekOutOfOrder = {
  sessionId: string;
  weekNumber: number;
  previousSessionId: string;
  previousWeekNumber: number;
};

export type CohortWeekInspection = {
  ordered: CohortWeekSession[];
  duplicates: number[];
  outOfOrder: CohortWeekOutOfOrder[];
  gaps: CohortWeekGap[];
};

/** 1-1 titles stay on chronological week numbers and are outside this guard. */
export function isOneToOneSessionTitle(title: string): boolean {
  return /\b1\s*[-–:]\s*1\b/i.test(title) || /\bone[\s-]to[\s-]one\b/i.test(title);
}

export function isGuardedCohortClassSession(
  session: CohortClassSessionMatchInput,
  anchorTitles?: ReadonlySet<string>
): boolean {
  if (isOneToOneSessionTitle(session.title)) return false;
  return isCohortClassSession(session, anchorTitles);
}

export function guardedClassSessions<
  T extends CohortClassSessionMatchInput & { id: string },
>(sessions: T[]): T[] {
  const anchors = cohortAnchorTitlesByCohort(sessions);
  return sessions.filter((session) =>
    isGuardedCohortClassSession(
      session,
      session.cohort_id ? anchors.get(session.cohort_id) : undefined
    )
  );
}

export function formatUkWeekDate(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return startsAt;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
}

export function formatWeekToken(weekNumber: number | null): string {
  return weekNumber == null ? "—" : `W${weekNumber}`;
}

export function sortCohortWeekSessions(sessions: CohortWeekSession[]): CohortWeekSession[] {
  return [...sessions].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)
  );
}

export function inspectCohortWeekNumbers(sessions: CohortWeekSession[]): CohortWeekInspection {
  const ordered = sortCohortWeekSessions(sessions);
  const counts = new Map<number, number>();
  for (const session of ordered) {
    if (session.weekNumber == null) continue;
    counts.set(session.weekNumber, (counts.get(session.weekNumber) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([week]) => week)
    .sort((a, b) => a - b);

  const outOfOrder: CohortWeekOutOfOrder[] = [];
  const gaps: CohortWeekGap[] = [];
  let previous: CohortWeekSession | null = null;
  for (const session of ordered) {
    if (session.weekNumber == null) continue;
    if (previous?.weekNumber != null) {
      if (session.weekNumber < previous.weekNumber) {
        outOfOrder.push({
          sessionId: session.id,
          weekNumber: session.weekNumber,
          previousSessionId: previous.id,
          previousWeekNumber: previous.weekNumber,
        });
      } else if (session.weekNumber > previous.weekNumber + 1) {
        gaps.push({
          from: previous.weekNumber,
          to: session.weekNumber,
          key: `${previous.weekNumber}→${session.weekNumber}`,
        });
      }
    }
    previous = session;
  }

  return { ordered, duplicates, outOfOrder, gaps };
}

export function formatWeekSequence(sessions: CohortWeekSession[]): string {
  return sortCohortWeekSessions(sessions)
    .map((session) => `${formatUkWeekDate(session.startsAt)}=${formatWeekToken(session.weekNumber)}`)
    .join(", ");
}

/**
 * Reject a cohort class-session week map that would duplicate a week number
 * or put a later session on a lower week. Gaps are allowed.
 */
export function cohortWeekNumberWriteError(sessions: CohortWeekSession[]): string | null {
  const report = inspectCohortWeekNumbers(sessions);
  if (report.duplicates.length > 0) {
    const week = report.duplicates[0]!;
    const dates = report.ordered
      .filter((session) => session.weekNumber === week)
      .map((session) => formatUkWeekDate(session.startsAt));
    return `Week ${week} would be used more than once (${dates.join(" and ")}). Each class in a cohort needs its own week number.`;
  }
  if (report.outOfOrder.length > 0) {
    const hit = report.outOfOrder[0]!;
    const later = report.ordered.find((session) => session.id === hit.sessionId);
    const earlier = report.ordered.find((session) => session.id === hit.previousSessionId);
    const laterDate = later ? formatUkWeekDate(later.startsAt) : "a later class";
    const earlierDate = earlier ? formatUkWeekDate(earlier.startsAt) : "an earlier class";
    return `Week ${hit.weekNumber} on ${laterDate} would come after week ${hit.previousWeekNumber} on ${earlierDate}. Week numbers have to stay in date order.`;
  }
  return null;
}

export function parseCohortWeekNumberInput(
  value: string
): { ok: true; weekNumber: number } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return { ok: false, error: "Week number must be a whole number of 1 or more." };
  }
  return { ok: true, weekNumber: Number(trimmed) };
}
