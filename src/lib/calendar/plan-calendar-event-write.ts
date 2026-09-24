import { localDateKey } from "./day-bounds";
import { isProtectedCalendarMatchMethod } from "./match-method";
import { UK_DISPLAY_TIMEZONE } from "./uk-display-time";

export type CalendarSessionSnapshot = {
  id: string;
  googleEventId: string;
  googleRecurringEventId: string | null;
  cohortId: string | null;
  studentId: string | null;
  matchMethod: string | null;
  startsAt: string;
  lessonId: string | null;
  lessonAssignmentStatus: "needs_assignment" | null;
  reschedulingAllowed: boolean;
};

export type IncomingCalendarEvent = {
  id: string;
  start: string;
  recurringEventId: string | null;
  matchCohortId: string | null;
  matchStudentId: string | null;
};

export type CarriedSessionFields = {
  lessonId: string | null;
  lessonAssignmentStatus: "needs_assignment" | null;
  matchMethod: string;
  cohortId: string | null;
  studentId: string | null;
  reschedulingAllowed: boolean;
};

export type CalendarEventPlan =
  | {
      action: "update-in-place";
      eventId: string;
      sessionId: string;
      googleEventId: string;
      retargeted: boolean;
      cohortId: string | null;
    }
  | {
      action: "upsert";
      eventId: string;
      deleteSessionIds: string[];
      carry: CarriedSessionFields | null;
      cohortId: string | null;
    };

export function ukSessionDateKey(iso: string): string {
  return localDateKey(iso, UK_DISPLAY_TIMEZONE);
}

function carryFrom(session: CalendarSessionSnapshot): CarriedSessionFields {
  return {
    lessonId: session.lessonId,
    lessonAssignmentStatus: session.lessonAssignmentStatus,
    matchMethod: session.matchMethod ?? "unmatched",
    cohortId: session.cohortId,
    studentId: session.studentId,
    reschedulingAllowed: session.cohortId ? false : session.reschedulingAllowed,
  };
}

function sameSeriesSameDayDonors(
  sessions: CalendarSessionSnapshot[],
  event: IncomingCalendarEvent,
  claimed: Set<string>
): CalendarSessionSnapshot[] {
  if (!event.recurringEventId) return [];
  const day = ukSessionDateKey(event.start);

  return sessions.filter((session) => {
    if (claimed.has(session.id)) return false;
    if (isProtectedCalendarMatchMethod(session.matchMethod)) return false;
    if (session.googleRecurringEventId !== event.recurringEventId) return false;
    if (session.googleEventId === event.id) return false;
    if (ukSessionDateKey(session.startsAt) !== day) return false;
    if (event.matchStudentId) return session.studentId === event.matchStudentId;
    if (event.matchCohortId) {
      return session.cohortId === event.matchCohortId && session.studentId == null;
    }
    return false;
  });
}

/**
 * Decide how one tutor's calendar payload is written.
 * reconcileRemovedCalendarEvents does not insert; callers apply these plans
 * before that delete, so a retargeted protected row already has the new event id.
 */
export function planTutorCalendarWrites(input: {
  events: IncomingCalendarEvent[];
  sessions: CalendarSessionSnapshot[];
  cancelledEventIds: string[];
}): { plans: CalendarEventPlan[]; cancelledEventIdsToDelete: string[] } {
  const byEventId = new Map(input.sessions.map((session) => [session.googleEventId, session]));
  const liveIncomingIds = new Set(input.events.map((event) => event.id));
  const claimed = new Set<string>();
  const plans: CalendarEventPlan[] = [];

  for (const event of input.events) {
    const existing = byEventId.get(event.id) ?? null;
    if (existing && !claimed.has(existing.id)) {
      if (isProtectedCalendarMatchMethod(existing.matchMethod)) {
        claimed.add(existing.id);
        plans.push({
          action: "update-in-place",
          eventId: event.id,
          sessionId: existing.id,
          googleEventId: event.id,
          retargeted: false,
          cohortId: existing.cohortId,
        });
        continue;
      }

      plans.push({
        action: "upsert",
        eventId: event.id,
        deleteSessionIds: [],
        carry: null,
        cohortId: event.matchStudentId ? null : event.matchCohortId,
      });
      continue;
    }

    if (event.matchCohortId && !event.matchStudentId) {
      const day = ukSessionDateKey(event.start);
      const sameDayProtected = input.sessions.filter((session) => {
        if (claimed.has(session.id)) return false;
        if (!isProtectedCalendarMatchMethod(session.matchMethod)) return false;
        if (session.cohortId !== event.matchCohortId) return false;
        if (session.studentId != null) return false;
        if (session.googleEventId === event.id) return false;
        if (liveIncomingIds.has(session.googleEventId)) return false;
        return ukSessionDateKey(session.startsAt) === day;
      });

      if (sameDayProtected.length === 1) {
        const target = sameDayProtected[0]!;
        claimed.add(target.id);
        plans.push({
          action: "update-in-place",
          eventId: event.id,
          sessionId: target.id,
          googleEventId: event.id,
          retargeted: true,
          cohortId: target.cohortId,
        });
        continue;
      }
    }

    const donors = sameSeriesSameDayDonors(input.sessions, event, claimed);
    let carry: CarriedSessionFields | null = null;
    let deleteSessionIds: string[] = [];
    if (donors.length === 1) {
      const donor = donors[0]!;
      claimed.add(donor.id);
      deleteSessionIds = [donor.id];
      carry = carryFrom(donor);
    } else if (donors.length > 1) {
      for (const donor of donors) claimed.add(donor.id);
      deleteSessionIds = donors.map((donor) => donor.id);
    }

    plans.push({
      action: "upsert",
      eventId: event.id,
      deleteSessionIds,
      carry,
      cohortId: carry?.cohortId ?? (event.matchStudentId ? null : event.matchCohortId),
    });
  }

  const cancelledBySeries = new Map<string, CalendarSessionSnapshot[]>();
  for (const session of input.sessions) {
    if (claimed.has(session.id)) continue;
    if (!input.cancelledEventIds.includes(session.googleEventId)) continue;
    const seriesId = session.googleRecurringEventId;
    if (!seriesId) continue;
    const list = cancelledBySeries.get(seriesId) ?? [];
    list.push(session);
    cancelledBySeries.set(seriesId, list);
  }

  const openUpsertsBySeries = new Map<string, CalendarEventPlan[]>();
  for (const plan of plans) {
    if (plan.action !== "upsert" || plan.carry || plan.deleteSessionIds.length > 0) continue;
    const event = input.events.find((item) => item.id === plan.eventId);
    if (!event?.recurringEventId) continue;
    if (byEventId.has(event.id)) continue;
    const seriesId = event.recurringEventId;
    const list = openUpsertsBySeries.get(seriesId) ?? [];
    list.push(plan);
    openUpsertsBySeries.set(seriesId, list);
  }

  for (const [seriesId, cancelledSessions] of cancelledBySeries) {
    const open = openUpsertsBySeries.get(seriesId) ?? [];
    if (cancelledSessions.length !== 1 || open.length !== 1) continue;
    const donor = cancelledSessions[0]!;
    const plan = open[0]!;
    if (plan.action !== "upsert") continue;
    claimed.add(donor.id);
    plan.deleteSessionIds = [donor.id];
    plan.carry = carryFrom(donor);
    plan.cohortId = donor.cohortId ?? plan.cohortId;
  }

  const retainedEventIds = new Set(
    input.sessions.filter((session) => claimed.has(session.id)).map((session) => session.googleEventId)
  );
  const cancelledEventIdsToDelete = input.cancelledEventIds.filter(
    (eventId) => !retainedEventIds.has(eventId)
  );

  return { plans, cancelledEventIdsToDelete };
}
