import { calendarSyncRangeEnd, calendarSyncRangeStart } from "@/lib/calendar/constants";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";

type GoogleEventsListResponse = {
  items?: GoogleApiEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

type GoogleApiDate = { dateTime?: string; date?: string };

type GoogleApiEvent = {
  id?: string;
  summary?: string;
  status?: string;
  updated?: string;
  recurringEventId?: string;
  recurrence?: string[];
  hangoutLink?: string;
  location?: string;
  start?: GoogleApiDate;
  end?: GoogleApiDate;
  originalStartTime?: GoogleApiDate;
  attendees?: { email?: string; responseStatus?: string }[];
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

const EVENT_FIELDS =
  "items(id,summary,status,updated,start,end,attendees(email),recurringEventId,location,hangoutLink,conferenceData(entryPoints)),nextPageToken,nextSyncToken";

function extractMeetLink(event: GoogleApiEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;

  const videoEntry = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri
  );
  return videoEntry?.uri ?? null;
}

function isoFromGoogleDate(value?: GoogleApiDate): string | null {
  return value?.dateTime ?? value?.date ?? null;
}

function mapGoogleEvent(event: GoogleApiEvent): GoogleCalendarEvent | null {
  if (!event.id) return null;

  const startIso =
    isoFromGoogleDate(event.start) ?? isoFromGoogleDate(event.originalStartTime);
  const endIso = isoFromGoogleDate(event.end) ?? startIso;
  if (!startIso || !endIso) return null;

  const attendeeEmails = (event.attendees ?? [])
    .map((a) => a.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));

  return {
    id: event.id,
    summary: event.summary?.trim() || "Lesson",
    start: startIso,
    end: endIso,
    hangoutLink: extractMeetLink(event),
    location: event.location ?? null,
    attendeeEmails,
    recurringEventId: event.recurringEventId ?? null,
    status: event.status,
    updated: event.updated,
  };
}

async function fetchEventPages(
  accessToken: string,
  calendarId: string,
  options?: { syncToken?: string | null; timeMin?: string; timeMax?: string }
): Promise<{
  events: GoogleCalendarEvent[];
  nextSyncToken: string | null;
  cancelledEventIds: string[];
}> {
  const events: GoogleCalendarEvent[] = [];
  const cancelledEventIds: string[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  const timeMin = options?.timeMin ?? calendarSyncRangeStart();
  const timeMax = options?.timeMax ?? calendarSyncRangeEnd();
  const useIncremental = Boolean(options?.syncToken);

  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      maxResults: "250",
      fields: EVENT_FIELDS,
    });

    if (useIncremental) {
      params.set("syncToken", options!.syncToken!);
    } else {
      params.set("orderBy", "startTime");
      params.set("timeMin", timeMin);
      params.set("timeMax", timeMax);
    }

    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 410) {
      return { events: [], nextSyncToken: null, cancelledEventIds: [] };
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar list failed: ${text}`);
    }

    const data = (await res.json()) as GoogleEventsListResponse;

    for (const item of data.items ?? []) {
      if (item.status === "cancelled") {
        if (item.id) cancelledEventIds.push(item.id);
        continue;
      }
      const mapped = mapGoogleEvent(item);
      if (mapped) events.push(mapped);
    }

    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken, cancelledEventIds };
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  options?: { syncToken?: string | null; timeMin?: string; timeMax?: string }
): Promise<{
  events: GoogleCalendarEvent[];
  nextSyncToken: string | null;
  cancelledEventIds: string[];
}> {
  let result = await fetchEventPages(accessToken, calendarId, options);

  if (options?.syncToken && result.events.length === 0 && result.nextSyncToken === null) {
    result = await fetchEventPages(accessToken, calendarId, { syncToken: null });
  }

  return result;
}

type GoogleApiAttendee = { email?: string; responseStatus?: string };

type GoogleApiEventDetail = {
  id?: string;
  attendees?: GoogleApiAttendee[];
};

export async function getGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<GoogleApiEventDetail> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?fields=id,attendees(email,responseStatus)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar get event failed: ${text}`);
  }

  return (await res.json()) as GoogleApiEventDetail;
}

/**
 * Adds an attendee to a calendar event (typically the master recurring event).
 * sendUpdates=all triggers Google's invite email.
 *
 * Known v1 limitation: detached recurring instances are not updated — see cohort-calendar-invite.ts.
 * TODO: Removing attendees when a student withdraws is not implemented.
 */
export async function addAttendeeToGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  attendeeEmail: string
): Promise<void> {
  const normalized = attendeeEmail.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Student email is required for a calendar invite.");
  }

  const event = await getGoogleCalendarEvent(accessToken, calendarId, eventId);
  const existing = event.attendees ?? [];
  if (existing.some((a) => a.email?.trim().toLowerCase() === normalized)) {
    return;
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attendees: [...existing, { email: normalized }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar patch event failed: ${text}`);
  }
}

export type CreateGoogleCalendarEventParams = {
  summary: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  attendeeEmails: string[];
};

export type CreateGoogleCalendarEventResult = {
  eventId: string;
  meetLink: string | null;
  attendeeEmails: string[];
};

/**
 * Updates event start/end times and notifies attendees (sendUpdates=all).
 */
export async function updateGoogleCalendarEventTimes(
  accessToken: string,
  calendarId: string,
  eventId: string,
  params: { startsAt: string; endsAt: string; timeZone: string }
): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start: { dateTime: params.startsAt, timeZone: params.timeZone },
      end: { dateTime: params.endsAt, timeZone: params.timeZone },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar update event times failed: ${text}`);
  }
}

/**
 * Creates a timed event on the tutor calendar with a Google Meet link and sends invites.
 */
export async function createGoogleCalendarEventWithMeet(
  accessToken: string,
  calendarId: string,
  params: CreateGoogleCalendarEventParams
): Promise<CreateGoogleCalendarEventResult> {
  const attendees = params.attendeeEmails
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .map((email) => ({ email }));

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startsAt, timeZone: params.timeZone },
      end: { dateTime: params.endsAt, timeZone: params.timeZone },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar create event failed: ${text}`);
  }

  const event = (await res.json()) as GoogleApiEvent;
  if (!event.id) {
    throw new Error("Google Calendar create event returned no event id.");
  }

  const attendeeEmails = (event.attendees ?? [])
    .map((a) => a.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));

  return {
    eventId: event.id,
    meetLink: extractMeetLink(event),
    attendeeEmails,
  };
}

export type DeleteGoogleCalendarEventResult = "deleted" | "already_gone";

/**
 * Deletes a single calendar event instance (never a recurring series master
 * unless that id is passed). sendUpdates=all notifies attendees.
 * 404/410 are treated as success (event already removed).
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<DeleteGoogleCalendarEventResult> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 204 || res.status === 200) {
    return "deleted";
  }
  // Already deleted / not found — treat as successful cancel outcome.
  if (res.status === 404 || res.status === 410) {
    return "already_gone";
  }

  const text = await res.text();
  throw new Error(`Google Calendar delete event failed (${res.status}): ${text.slice(0, 500)}`);
}

export type GoogleCalendarRecurringMaster = {
  id: string;
  summary: string;
  start: string;
  end: string;
  hangoutLink: string | null;
  location: string | null;
  attendeeEmails: string[];
  recurrence: string[];
  status?: string;
};

const MASTER_EVENT_FIELDS =
  "items(id,summary,status,start,end,recurrence,attendees(email),location,hangoutLink,conferenceData(entryPoints)),nextPageToken";

const INSTANCE_EVENT_FIELDS =
  "items(id,summary,status,start,end,originalStartTime,attendees(email),recurringEventId,location,hangoutLink,conferenceData(entryPoints)),nextPageToken";

function mapRecurringMaster(event: GoogleApiEvent): GoogleCalendarRecurringMaster | null {
  if (!event.id || event.status === "cancelled") return null;
  const recurrence = (event.recurrence ?? []).filter(Boolean);
  if (recurrence.length === 0) return null;

  const startIso = isoFromGoogleDate(event.start);
  const endIso = isoFromGoogleDate(event.end);
  if (!startIso || !endIso) return null;

  const attendeeEmails = (event.attendees ?? [])
    .map((a) => a.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));

  return {
    id: event.id,
    summary: event.summary?.trim() || "Lesson",
    start: startIso,
    end: endIso,
    hangoutLink: extractMeetLink(event),
    location: event.location ?? null,
    attendeeEmails,
    recurrence,
    status: event.status,
  };
}

/** Unexpanded events (masters + one-offs). Recurring series include RRULE. */
export async function listGoogleCalendarRecurringMasters(
  accessToken: string,
  calendarId: string,
  options: { timeMin: string; timeMax: string }
): Promise<GoogleCalendarRecurringMaster[]> {
  const masters: GoogleCalendarRecurringMaster[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      singleEvents: "false",
      maxResults: "250",
      fields: MASTER_EVENT_FIELDS,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar list masters failed: ${text}`);
    }

    const data = (await res.json()) as GoogleEventsListResponse;
    for (const item of data.items ?? []) {
      const mapped = mapRecurringMaster(item);
      if (mapped) masters.push(mapped);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return masters;
}

/** Expanded instances of one recurring series, including cancelled (showDeleted). */
export async function listGoogleCalendarEventInstances(
  accessToken: string,
  calendarId: string,
  eventId: string,
  options: { timeMin: string; timeMax: string; maxResults?: number }
): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  const maxResults = String(options.maxResults ?? 40);

  do {
    const params = new URLSearchParams({
      maxResults,
      fields: INSTANCE_EVENT_FIELDS,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      showDeleted: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}/instances?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar list instances failed: ${text}`);
    }

    const data = (await res.json()) as GoogleEventsListResponse;
    for (const item of data.items ?? []) {
      const mapped = mapGoogleEvent(item);
      if (mapped) events.push(mapped);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  events.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  return events;
}
