import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { User } from "@supabase/supabase-js";

const REFRESH_WITHIN_SECONDS = 60;
const BASE64_PREFIX = "base64-";

export type CookieReader = {
  getAll(): Array<{ name: string; value: string }>;
};

export type LocalSession = {
  user: User | null;
  refresh: boolean;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function signingKeys() {
  if (!jwks) {
    const url = new URL(
      "/auth/v1/.well-known/jwks.json",
      process.env.NEXT_PUBLIC_SUPABASE_URL!
    );
    jwks = createRemoteJWKSet(url, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    });
  }
  return jwks;
}

export function authStorageKey() {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

function decodeCookiePayload(value: string): string | null {
  if (!value.startsWith(BASE64_PREFIX)) return value;
  try {
    const padded = value
      .slice(BASE64_PREFIX.length)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    JSON.parse(decoded);
    return decoded;
  } catch {
    return null;
  }
}

export function readSessionJson(cookies: CookieReader): string | null {
  const key = authStorageKey();
  const all = cookies.getAll();
  const single = all.find((cookie) => cookie.name === key);
  const raw = single
    ? single.value
    : all
        .filter((cookie) => cookie.name.startsWith(`${key}.`))
        .sort((a, b) => Number(a.name.slice(key.length + 1)) - Number(b.name.slice(key.length + 1)))
        .map((cookie) => cookie.value)
        .join("");
  if (!raw) return null;
  return decodeCookiePayload(raw);
}

function userFromClaims(payload: JWTPayload): User {
  const appMetadata =
    payload.app_metadata && typeof payload.app_metadata === "object"
      ? (payload.app_metadata as User["app_metadata"])
      : {};
  const userMetadata =
    payload.user_metadata && typeof payload.user_metadata === "object"
      ? (payload.user_metadata as User["user_metadata"])
      : {};
  return {
    id: String(payload.sub),
    aud: String(payload.aud ?? "authenticated"),
    role: typeof payload.role === "string" ? payload.role : "authenticated",
    email: typeof payload.email === "string" ? payload.email : undefined,
    phone: typeof payload.phone === "string" ? payload.phone : undefined,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
    created_at: typeof payload.iat === "number" ? new Date(payload.iat * 1000).toISOString() : "",
  } as User;
}

export async function verifiedUserFromCookies(cookies: CookieReader): Promise<LocalSession> {
  const json = readSessionJson(cookies);
  if (!json) return { user: null, refresh: false };
  let accessToken = "";
  try {
    const session = JSON.parse(json) as { access_token?: string };
    accessToken = session.access_token || "";
  } catch {
    return { user: null, refresh: true };
  }
  if (!accessToken) return { user: null, refresh: true };

  try {
    const { payload } = await jwtVerify(accessToken, signingKeys(), {
      audience: "authenticated",
    });
    if (!payload.sub) return { user: null, refresh: true };
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    const refresh = exp - Math.floor(Date.now() / 1000) <= REFRESH_WITHIN_SECONDS;
    return { user: userFromClaims(payload), refresh };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ERR_JWT_EXPIRED") return { user: null, refresh: true };
    return { user: null, refresh: true };
  }
}

export function isPrefetchRequest(headers: { get(name: string): string | null }) {
  return (
    headers.get("next-router-prefetch") === "1" ||
    headers.get("purpose") === "prefetch" ||
    headers.get("x-middleware-prefetch") === "1"
  );
}
