import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshGoogleAccessToken } from "@/lib/calendar/google-oauth";

export type TutorCalendarConnectionRow = {
  tutor_id: string;
  google_account_email: string;
  calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
};

/** Reuse the same refresh path as tutor calendar sync. */
export async function getValidTutorAccessToken(
  adminClient: SupabaseClient,
  connection: TutorCalendarConnectionRow
): Promise<string> {
  const expiresAtMs = new Date(connection.token_expires_at).getTime();
  if (expiresAtMs > Date.now() + 60_000) {
    return connection.access_token;
  }

  const refreshed = await refreshGoogleAccessToken(connection.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await adminClient
    .from("tutor_google_calendar_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? connection.refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq("tutor_id", connection.tutor_id);

  return refreshed.access_token;
}
