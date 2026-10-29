import {
  eventTimeZone,
  lessonDateInEventTimeZone,
  utcDateKey,
} from "@/lib/calendar/event-timezone";

const CLASS_MATCH_METHODS = new Set(["manual", "calendar_link", "attendee_email"]);

export type LessonLogSessionCandidate = {
  id: string;
  googleEventId: string;
  startsAt: string;
  eventTimeZone: string | null;
  cohortId: string | null;
  packageInstanceId: string | null;
  matchMethod: string | null;
  status: string | null;
};

export type PlannedTutorLessonLog =
  | {
      ok: true;
      lessonDate: string;
      needsReview: boolean;
      needsReviewReason: "no_calendar_event" | null;
      scheduledSessionId: string | null;
      googleEventId: string | null;
      googleEventIds: string[];
      sessionStartsAt: string | null;
      eventTimeZone: string | null;
      earlyOverrideBy: string | null;
      earlyOverrideReason: string | null;
    }
  | { ok: false; error: string };

export function isClassMatchedSession(session: {
  cohortId: string | null;
  packageInstanceId: string | null;
  matchMethod: string | null;
  status: string | null;
}): boolean {
  if (session.status === "cancelled") return false;
  if (!session.matchMethod || !CLASS_MATCH_METHODS.has(session.matchMethod)) return false;
  return Boolean(session.cohortId || session.packageInstanceId);
}

function instantKey(iso: string): string {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? iso : String(ms);
}

function targetKey(session: LessonLogSessionCandidate): string | null {
  if (session.cohortId) return `cohort:${session.cohortId}`;
  if (session.packageInstanceId) return `package:${session.packageInstanceId}`;
  return null;
}

/** Groups class sessions that are the same class at the same start instant. */
export function collapseClassSessions(
  candidates: LessonLogSessionCandidate[]
): LessonLogSessionCandidate[][] {
  const groups = new Map<string, LessonLogSessionCandidate[]>();
  for (const session of candidates) {
    if (!isClassMatchedSession(session)) continue;
    const target = targetKey(session);
    if (!target) continue;
    const key = `${target}|${instantKey(session.startsAt)}`;
    const list = groups.get(key) ?? [];
    list.push(session);
    groups.set(key, list);
  }
  return [...groups.values()].map((group) =>
    [...group].sort((a, b) => a.googleEventId.localeCompare(b.googleEventId))
  );
}

function sessionLocalDate(session: LessonLogSessionCandidate): string {
  return lessonDateInEventTimeZone(session.startsAt, session.eventTimeZone);
}

/**
 * Pick the collapsed group for a date the tutor or Notion supplied.
 * Tutor saves match the event-local date only.
 * Notion pulls can also match the UTC date, then the stored pay date is still local.
 */
export function matchClassSessionGroup(input: {
  candidates: LessonLogSessionCandidate[];
  typedDate: string;
  now: Date;
  alsoMatchUtcDate?: boolean;
}): LessonLogSessionCandidate[] | null {
  const groups = collapseClassSessions(input.candidates);
  const localMatches = groups.filter((group) => sessionLocalDate(group[0]) === input.typedDate);
  const utcMatches =
    input.alsoMatchUtcDate === true
      ? groups.filter((group) => {
          if (sessionLocalDate(group[0]) === input.typedDate) return false;
          return utcDateKey(group[0].startsAt) === input.typedDate;
        })
      : [];
  const matching = localMatches.length > 0 ? localMatches : utcMatches;
  if (matching.length === 0) return null;

  const started = matching.filter(
    (group) => new Date(group[0].startsAt).getTime() <= input.now.getTime()
  );
  const pool = started.length > 0 ? started : matching;
  pool.sort((a, b) => {
    const aGap = Math.abs(new Date(a[0].startsAt).getTime() - input.now.getTime());
    const bGap = Math.abs(new Date(b[0].startsAt).getTime() - input.now.getTime());
    return aGap - bGap;
  });
  return pool[0] ?? null;
}

export function planTutorLessonLog(input: {
  now: Date;
  typedDate: string;
  sessions: LessonLogSessionCandidate[];
  isAdmin: boolean;
  earlyOverrideReason: string | null;
  earlyOverrideBy: string | null;
}): PlannedTutorLessonLog {
  const typedDate = input.typedDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(typedDate)) {
    return { ok: false, error: "Choose the date you taught." };
  }

  const group = matchClassSessionGroup({
    candidates: input.sessions,
    typedDate,
    now: input.now,
  });

  if (!group) {
    return {
      ok: true,
      lessonDate: typedDate,
      needsReview: true,
      needsReviewReason: "no_calendar_event",
      scheduledSessionId: null,
      googleEventId: null,
      googleEventIds: [],
      sessionStartsAt: null,
      eventTimeZone: null,
      earlyOverrideBy: null,
      earlyOverrideReason: null,
    };
  }

  const canonical = group[0];
  const startsAt = new Date(canonical.startsAt);
  const lessonDate = sessionLocalDate(canonical);
  const beforeStart = startsAt.getTime() > input.now.getTime();
  const reason = input.earlyOverrideReason?.trim() ?? "";

  if (beforeStart) {
    if (!input.isAdmin) {
      return {
        ok: false,
        error: "This lesson has not started yet. You can log it once it has started.",
      };
    }
    if (!reason || !input.earlyOverrideBy) {
      return {
        ok: false,
        error: "This lesson has not started yet. Add a reason to log it early.",
      };
    }
  }

  return {
    ok: true,
    lessonDate,
    needsReview: false,
    needsReviewReason: null,
    scheduledSessionId: canonical.id,
    googleEventId: canonical.googleEventId,
    googleEventIds: group.map((session) => session.googleEventId),
    sessionStartsAt: canonical.startsAt,
    eventTimeZone: eventTimeZone(canonical.eventTimeZone),
    earlyOverrideBy: beforeStart ? input.earlyOverrideBy : null,
    earlyOverrideReason: beforeStart ? reason : null,
  };
}

/** Pay date for a Notion page once a class session has been matched. */
export function lessonDateForMatchedSession(session: LessonLogSessionCandidate): string {
  return sessionLocalDate(session);
}

/**
 * Session columns went onto production at this instant. Rows created earlier
 * are left alone when a Notion page is pulled again.
 */
export const LESSON_LOG_SESSION_ATTACH_CUTOFF = "2026-10-22T10:05:00.000Z";

export function lessonLogRowCanReceiveSession(
  createdAt: string | null | undefined
): boolean {
  if (!createdAt) return true;
  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) return true;
  return createdMs >= Date.parse(LESSON_LOG_SESSION_ATTACH_CUTOFF);
}
