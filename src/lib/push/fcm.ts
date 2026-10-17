import "server-only";

import { importPKCS8, SignJWT } from "jose";
import { fcmUnregistered } from "@/lib/push/fcm-error";

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

export type FcmSendResult =
  | { ok: true }
  | { ok: false; unregistered: boolean; error: string };

let tokenCache: { token: string; projectId: string; expiresAt: number } | null = null;

export function fcmConfigured(): boolean {
  return Boolean(process.env.FCM_SERVICE_ACCOUNT_JSON?.trim());
}

function serviceAccount(): ServiceAccount {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim() ?? "";
  return JSON.parse(raw) as ServiceAccount;
}

async function fcmAccess(): Promise<{ projectId: string; token: string }> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return { projectId: tokenCache.projectId, token: tokenCache.token };
  }
  const account = serviceAccount();
  const projectId = account.project_id?.trim() ?? "";
  const email = account.client_email?.trim() ?? "";
  const privateKey = account.private_key?.replace(/\\n/g, "\n").trim() ?? "";
  if (!projectId || !email || !privateKey) {
    throw new Error("FCM service account is incomplete");
  }
  const key = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await response.json()) as { access_token?: string };
  if (!response.ok || !json.access_token) {
    throw new Error("FCM auth failed");
  }
  tokenCache = { token: json.access_token, projectId, expiresAt: Date.now() + 50 * 60 * 1000 };
  return { projectId, token: json.access_token };
}

export async function postFcm(input: {
  deviceToken: string;
  title: string;
  body: string;
  url: string;
  type: string;
}): Promise<FcmSendResult> {
  const access = await fcmAccess();
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${access.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: input.deviceToken,
          notification: { title: input.title, body: input.body },
          data: { url: input.url, type: input.type, title: input.title, body: input.body },
          android: {
            priority: "HIGH",
            notification: { channel_id: "kidda", sound: "default" },
          },
        },
      }),
    }
  );
  if (response.ok) return { ok: true };
  const body = await response.text();
  return {
    ok: false,
    unregistered: fcmUnregistered(response.status, body),
    error: body.slice(0, 300) || `HTTP ${response.status}`,
  };
}
