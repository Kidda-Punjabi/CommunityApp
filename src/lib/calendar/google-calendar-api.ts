import { calendarSyncRangeEnd, calendarSyncRangeStart } from "@/lib/calendar/constants";
import type { GoogleCalendarEvent } from "@/lib/calendar/types";

type GoogleEventsListResponse = {
  items?: GoogleApiEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

type GoogleApiEvent = {
  id?: string;
  summary?: string;
  status?: string;
  updated?: string;
  recurringEventId?: string;
  hangoutLink?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
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

function mapGoogleEvent(event: GoogleApiEvent): GoogleCalendarEvent | null {
  if (!event.id) return null;

  const startIso = event.start?.dateTime ?? event.start?.date;
  const endIso = event.end?.dateTime ?? event.end?.date;
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
