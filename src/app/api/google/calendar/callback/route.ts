import { NextResponse } from "next/server";
import {
  exchangeGoogleAuthCode,
  fetchGoogleUserEmail,
  verifyOAuthState,
} from "@/lib/calendar/google-oauth";
import { syncTutorGoogleCalendar, upsertTutorGoogleConnection } from "@/lib/calendar/sync-tutor-calendar";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      appUrl(`/dashboard/tutor/calendar?error=${encodeURIComponent(oauthError)}`)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(appUrl("/dashboard/tutor/calendar?error=missing_code"));
  }

  const payload = verifyOAuthState(state);
  if (!payload) {
    return NextResponse.redirect(appUrl("/dashboard/tutor/calendar?error=invalid_state"));
  }

  const { client, error: configError } = tryCreateServiceRoleClient();
  if (!client) {
    return NextResponse.redirect(
      appUrl(`/dashboard/tutor/calendar?error=${encodeURIComponent(configError)}`)
    );
  }

  try {
    const tokens = await exchangeGoogleAuthCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        appUrl("/dashboard/tutor/calendar?error=missing_refresh_token")
      );
    }

    const email = await fetchGoogleUserEmail(tokens.access_token);

    await upsertTutorGoogleConnection(client, payload.tutorId, {
      googleAccountEmail: email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expires_in,
    });

    await syncTutorGoogleCalendar(client, payload.tutorId);

    return NextResponse.redirect(appUrl("/dashboard/tutor/calendar?connected=1"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "connect_failed";
    return NextResponse.redirect(
      appUrl(`/dashboard/tutor/calendar?error=${encodeURIComponent(message)}`)
    );
  }
}
