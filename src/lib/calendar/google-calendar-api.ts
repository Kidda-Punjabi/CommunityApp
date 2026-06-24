import { CALENDAR_SYNC_LOOKAHEAD_DAYS } from "@/lib/calendar/constants";
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
  hangoutLink?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; responseStatus?: string }[];
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

function extractMeetLink(event: GoogleApiEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;

  const videoEntry = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri
  );
  return videoEntry?.uri ?? null;
}

function mapGoogleEvent(event: GoogleApiEvent): GoogleCalendarEvent | null {
  if (!event.id || !event.summary) return null;

  const startIso = event.start?.dateTime ?? event.start?.date;
  const endIso = event.end?.dateTime ?? event.end?.date;
  if (!startIso || !endIso) return null;

  const attendeeEmails = (event.attendees ?? [])
    .map((a) => a.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));

  return {
    id: event.id,
    summary: event.summary,
    start: startIso,
    end: endIso,
    hangoutLink: extractMeetLink(event),
    location: event.location ?? null,
    attendeeEmails,
    status: event.status,
    updated: event.updated,
  };
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  options?: { syncToken?: string | null }
): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken: string | null }> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  const timeMin = new Date().toISOString();
  const timeMax = new Date(
    Date.now() + CALENDAR_SYNC_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    if (options?.syncToken) {
      params.set("syncToken", options.syncToken);
    } else {
      params.set("timeMin", timeMin);
      params.set("timeMax", timeMax);
    }

    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar list failed: ${text}`);
    }

    const data = (await res.json()) as GoogleEventsListResponse;

    for (const item of data.items ?? []) {
      if (item.status === "cancelled") continue;
      const mapped = mapGoogleEvent(item);
      if (mapped) events.push(mapped);
    }

    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken };
}
