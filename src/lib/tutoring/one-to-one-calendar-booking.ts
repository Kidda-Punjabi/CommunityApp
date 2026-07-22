import "server-only";

import { createGoogleCalendarEventWithMeet } from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OneToOneCalendarBookingResult =
  | { ok: true; sessionId: string; meetLink: string | null }
  | { ok: false; error: string };

export async function createOneToOneCalendarSession(
  admin: SupabaseClient,
  params: {
    tutorId: string;
    studentId: string;
    studentEmail: string;
    startsAt: string;
    endsAt: string;
    courseId: string | null;
    title: string;
    notes: string | null;
    timeZone: string;
  }
): Promise<OneToOneCalendarBookingResult> {
  const studentEmail = params.studentEmail.trim().toLowerCase();
  if (!studentEmail) {
    return { ok: false, error: "Your account needs an email address for a calendar invite." };
  }

  const { data: connection, error: connectionError } = await admin
    .from("tutor_google_calendar_connections")
    .select(
      "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
    )
    .eq("tutor_id", params.tutorId)
    .maybeSingle();

  if (connectionError) {
    return { ok: false, error: connectionError.message };
  }
  if (!connection) {
    return {
      ok: false,
      error: "Your tutor has not connected Google Calendar yet. Try again later or contact support.",
    };
  }

  let accessToken: string;
  try {
    accessToken = await getValidTutorAccessToken(admin, connection as TutorCalendarConnectionRow);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not refresh tutor calendar access.";
    return { ok: false, error: message };
  }

  const descriptionParts = ["Booked via Kidda Community."];
  if (params.notes) descriptionParts.push(`Student note: ${params.notes}`);

  let googleEvent: Awaited<ReturnType<typeof createGoogleCalendarEventWithMeet>>;
  try {
    googleEvent = await createGoogleCalendarEventWithMeet(
      accessToken,
      connection.calendar_id as string,
      {
        summary: params.title,
        description: descriptionParts.join("\n\n"),
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        timeZone: params.timeZone,
        attendeeEmails: [studentEmail, connection.google_account_email as string],
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Google Calendar could not create the lesson.";
    return { ok: false, error: message };
  }

  const attendeeEmails = [
    ...new Set([studentEmail, ...googleEvent.attendeeEmails.map((e) => e.toLowerCase())]),
  ];

  const { data: session, error: insertError } = await admin
    .from("tutor_scheduled_sessions")
    .insert({
      tutor_id: params.tutorId,
      google_event_id: googleEvent.eventId,
      student_id: params.studentId,
      course_id: params.courseId,
      title: params.title,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      meet_link: googleEvent.meetLink,
      attendee_emails: attendeeEmails,
      match_method: "manual",
      status: "scheduled",
      rescheduling_allowed: true,
    })
    .select("id")
    .single();

  if (insertError || !session) {
    return { ok: false, error: insertError?.message ?? "Could not save the scheduled lesson." };
  }

  return {
    ok: true,
    sessionId: session.id as string,
    meetLink: googleEvent.meetLink,
  };
}
