import "server-only";

import {
  addAttendeeToGoogleCalendarEvent,
  removeAttendeeFromGoogleCalendarEvent,
} from "@/lib/calendar/google-calendar-api";
import {
  getValidTutorAccessToken,
  type TutorCalendarConnectionRow,
} from "@/lib/calendar/tutor-access-token";
import { ARSH_USER_ID } from "@/lib/community/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export function communitySeriesId(googleEventId: string): string {
  return googleEventId.replace(/_\d{8}T\d{6}Z$/, "");
}

async function seriesIdForSession(admin: SupabaseClient, sessionId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("community_session_occurrences")
    .select("google_event_id")
    .eq("session_id", sessionId)
    .not("google_event_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.google_event_id) return null;
  return communitySeriesId(data.google_event_id as string);
}

async function arshConnection(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("tutor_google_calendar_connections")
    .select("tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at")
    .eq("tutor_id", ARSH_USER_ID)
    .maybeSingle();
  if (error) throw error;
  return data as TutorCalendarConnectionRow | null;
}

async function memberEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data.user?.email?.trim().toLowerCase() || null;
}

async function markInvite(
  admin: SupabaseClient,
  userId: string,
  status: "sent" | "failed",
  error: string | null
) {
  await admin
    .from("community_memberships_meta")
    .update({ calendar_invite_status: status, calendar_invite_error: error })
    .eq("user_id", userId);
}

/** Adds the member to the new series and removes them from the previous one. */
export async function syncCommunityCalendarGuest(
  admin: SupabaseClient,
  userId: string,
  previousSessionId: string | null,
  nextSessionId: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const email = await memberEmail(admin, userId);
    if (!email) {
      await markInvite(admin, userId, "failed", "No email on the account.");
      return { ok: false, error: "No email on the account." };
    }
    const connection = await arshConnection(admin);
    if (!connection) {
      await markInvite(admin, userId, "failed", "Arsh's calendar is not connected.");
      return { ok: false, error: "Arsh's calendar is not connected." };
    }
    const accessToken = await getValidTutorAccessToken(admin, connection);
    if (previousSessionId && previousSessionId !== nextSessionId) {
      const previousSeries = await seriesIdForSession(admin, previousSessionId);
      if (previousSeries) {
        await removeAttendeeFromGoogleCalendarEvent(accessToken, connection.calendar_id, previousSeries, email);
      }
    }
    if (!nextSessionId) {
      await markInvite(admin, userId, "sent", null);
      return { ok: true };
    }
    const seriesId = await seriesIdForSession(admin, nextSessionId);
    if (!seriesId) {
      await markInvite(admin, userId, "failed", "No calendar series for that session yet.");
      return { ok: false, error: "No calendar series for that session yet." };
    }
    await addAttendeeToGoogleCalendarEvent(accessToken, connection.calendar_id, seriesId, email);
    await markInvite(admin, userId, "sent", null);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar invite failed.";
    console.error("[community] calendar invite failed", userId, message);
    await markInvite(admin, userId, "failed", message);
    return { ok: false, error: message };
  }
}

export async function removeCommunityCalendarGuest(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("community_memberships_meta")
    .select("main_session_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.main_session_id) return { ok: true };
  return syncCommunityCalendarGuest(admin, userId, data.main_session_id as string, null);
}
