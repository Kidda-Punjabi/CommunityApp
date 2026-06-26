import { createHmac, timingSafeEqual } from "crypto";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/calendar/constants";

import { getPublicAppUrl } from "@/lib/app-url";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type OAuthStatePayload = {
  tutorId: string;
  issuedAt: number;
};

function getOAuthSecret(): string {
  const secret =
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("GOOGLE_CALENDAR_OAUTH_STATE_SECRET or SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  return secret;
}

export function signOAuthState(payload: OAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getOAuthSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getOAuthSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!payload.tutorId || !payload.issuedAt) return null;
    if (Date.now() - payload.issuedAt > 15 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getGoogleCalendarRedirectUri(): string {
  const configured = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${getPublicAppUrl()}/api/google/calendar/callback`;
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: getGoogleCalendarRedirectUri(),
  };
}

export function isGoogleOAuthConfigured(): boolean {
  return getGoogleOAuthConfig() !== null;
}

export function buildGoogleCalendarConnectUrl(tutorId: string): string | null {
  const config = getGoogleOAuthConfig();
  if (!config) return null;

  const state = signOAuthState({ tutorId, issuedAt: Date.now() });
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export async function exchangeGoogleAuthCode(code: string): Promise<GoogleTokenResponse> {
  const config = getGoogleOAuthConfig();
  if (!config) {
    throw new Error("Google Calendar OAuth is not configured.");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const config = getGoogleOAuthConfig();
  if (!config) {
    throw new Error("Google Calendar OAuth is not configured.");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${text}`);
  }

  return (await res.json()) as GoogleTokenResponse;
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch Google account email.");
  }

  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("Google account has no email.");
  return data.email;
}
