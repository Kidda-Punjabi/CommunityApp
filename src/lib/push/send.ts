import "server-only";

import http2, { type ClientHttp2Session } from "node:http2";
import { importPKCS8, SignJWT } from "jose";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import {
  CAP_EXEMPT,
  TYPE_CATEGORY,
  kidTitle,
  localDateKey,
  planDelivery,
  type PushCategory,
} from "@/lib/push/policy";

export type SendPushInput = {
  userId: string;
  kidProfileId?: string | null;
  type: string;
  refKey: string;
  title: string;
  body: string;
  url: string;
  category?: PushCategory;
  expiresAt?: Date | null;
  /** Extra types recorded for the same delivery, without a second APNs send. */
  alsoLog?: Array<{ type: string; refKey: string }>;
  /** Retries already stored the child-prefixed title. */
  skipKidPrefix?: boolean;
  /** Test hook. Production callers leave this unset. */
  now?: Date;
};

export type SendPushResult =
  | "sent"
  | "skipped"
  | "deferred"
  | "dropped"
  | "failed"
  | "unconfigured";

type TokenRow = {
  id: string;
  token: string;
  disabled_at: string | null;
};

type SettingsRow = {
  class_reminders?: boolean | null;
  lesson_scheduling?: boolean | null;
  homework_due?: boolean | null;
  homework_reviews?: boolean | null;
  community_sessions?: boolean | null;
  forum_activity?: boolean | null;
  streaks?: boolean | null;
  weekly_recap?: boolean | null;
  friend_requests?: boolean | null;
  game_challenges?: boolean | null;
  announcements?: boolean | null;
};

let jwtCache: { token: string; expiresAt: number } | null = null;
let apnsSession: { host: string; client: ClientHttp2Session } | null = null;

function apnsConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY_ID?.trim() &&
      process.env.APNS_TEAM_ID?.trim() &&
      process.env.APNS_KEY_P8?.trim() &&
      process.env.APNS_BUNDLE_ID?.trim()
  );
}

function apnsHost(): string {
  return process.env.APNS_ENV?.trim() === "production"
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";
}

function privateKeyPem(): string {
  return (process.env.APNS_KEY_P8 ?? "").replace(/\\n/g, "\n").trim();
}

async function apnsJwt(): Promise<string> {
  if (jwtCache && jwtCache.expiresAt > Date.now() + 60_000) return jwtCache.token;
  const key = await importPKCS8(privateKeyPem(), "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APNS_KEY_ID!.trim() })
    .setIssuer(process.env.APNS_TEAM_ID!.trim())
    .setIssuedAt()
    .sign(key);
  jwtCache = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

function sessionFor(host: string): ClientHttp2Session {
  if (apnsSession && apnsSession.host === host && !apnsSession.client.closed && !apnsSession.client.destroyed) {
    return apnsSession.client;
  }
  apnsSession?.client.close();
  const client = http2.connect(`https://${host}`);
  apnsSession = { host, client };
  return client;
}

export function closeApns(): void {
  apnsSession?.client.close();
  apnsSession = null;
}

function postApns(
  deviceToken: string,
  payload: Record<string, unknown>
): Promise<{ status: number; body: string }> {
  const host = apnsHost();
  const client = sessionFor(host);
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwtCache?.token ?? ""}`,
      "apns-topic": process.env.APNS_BUNDLE_ID!.trim(),
      "apns-push-type": "alert",
      "apns-priority": "10",
    });
    const chunks: Buffer[] = [];
    req.on("response", (headers) => {
      const status = Number(headers[":status"] ?? 0);
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

function refKeyFor(input: SendPushInput): string {
  if (!input.kidProfileId) return input.refKey;
  return input.refKey.includes(`:kid:${input.kidProfileId}`)
    ? input.refKey
    : `${input.refKey}:kid:${input.kidProfileId}`;
}

function categoryEnabled(settings: SettingsRow | null, category: PushCategory): boolean {
  if (category === "always") return true;
  if (!settings) return true;
  const value = settings[category];
  return value !== false;
}

async function sentNonClassToday(
  userId: string,
  timeZone: string,
  now: Date
): Promise<number> {
  const admin = createServiceRoleClient();
  const day = localDateKey(now, timeZone);
  const { data } = await admin
    .from("push_send_log")
    .select("type, sent_at, status")
    .eq("user_id", userId)
    .eq("status", "sent")
    .gte("sent_at", new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString());

  return (data ?? []).filter((row) => {
    if (CAP_EXEMPT.has(row.type as string)) return false;
    return localDateKey(new Date(row.sent_at as string), timeZone) === day;
  }).length;
}

async function writeLog(row: {
  userId: string;
  kidProfileId: string | null;
  type: string;
  refKey: string;
  status: string;
  error?: string | null;
  notBefore?: Date | null;
  title?: string;
  body?: string;
  url?: string;
  expiresAt?: Date | null;
}): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("push_send_log").upsert(
    {
      user_id: row.userId,
      kid_profile_id: row.kidProfileId,
      type: row.type,
      ref_key: row.refKey,
      sent_at: new Date().toISOString(),
      status: row.status,
      error: row.error ?? null,
      not_before: row.notBefore?.toISOString() ?? null,
      title: row.title ?? null,
      body: row.body ?? null,
      url: row.url ?? null,
      expires_at: row.expiresAt?.toISOString() ?? null,
    },
    { onConflict: "user_id,type,ref_key" }
  );
  if (error) console.error("[push] log", error.message);
}

async function recordOutcome(
  row: Parameters<typeof writeLog>[0],
  alsoLog: Array<{ type: string; refKey: string }> | undefined,
  kidProfileId: string | null
): Promise<void> {
  await writeLog(row);
  for (const extra of alsoLog ?? []) {
    await writeLog({
      ...row,
      type: extra.type,
      refKey: refKeyFor({
        userId: row.userId,
        kidProfileId,
        type: extra.type,
        refKey: extra.refKey,
        title: row.title ?? "",
        body: row.body ?? "",
        url: row.url ?? "",
      }),
    });
  }
}

export async function sendPush(input: SendPushInput): Promise<SendPushResult> {
  const admin = createServiceRoleClient();
  const now = input.now ?? new Date();
  let userId = input.userId;
  let title = input.title;
  const kidProfileId = input.kidProfileId ?? null;

  if (kidProfileId) {
    const { data: kid } = await admin
      .from("kid_profiles")
      .select("name, parent_user_id")
      .eq("id", kidProfileId)
      .maybeSingle();
    if (kid?.parent_user_id) userId = kid.parent_user_id as string;
    if (kid?.name && !input.skipKidPrefix) title = kidTitle(String(kid.name), title);
  }

  const category = input.category ?? TYPE_CATEGORY[input.type] ?? "always";
  const refKey = refKeyFor({ ...input, userId });
  const [{ data: settings }, { data: profile }, { data: existing }] = await Promise.all([
    admin.from("notification_settings").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    admin
      .from("push_send_log")
      .select("status, not_before")
      .eq("user_id", userId)
      .eq("type", input.type)
      .eq("ref_key", refKey)
      .maybeSingle(),
  ]);

  const timeZone = (profile?.timezone as string | null)?.trim() || "Europe/London";
  const nonClassSent = await sentNonClassToday(userId, timeZone, now);
  const plan = planDelivery({
    type: input.type,
    now,
    timeZone,
    categoryEnabled: categoryEnabled(settings as SettingsRow | null, category),
    logStatus: (existing?.status as string | null) ?? null,
    notBefore: existing?.not_before ? new Date(existing.not_before as string) : null,
    sentNonClassToday: nonClassSent,
    expiresAt: input.expiresAt ?? null,
    kidProfileId,
  });

  if (plan.action === "skip") return "skipped";
  const outcomeBase = {
    userId,
    kidProfileId,
    type: input.type,
    refKey,
    title,
    body: input.body,
    url: input.url,
    expiresAt: input.expiresAt,
  };
  if (plan.action === "drop") {
    await recordOutcome(
      { ...outcomeBase, status: "dropped", error: plan.reason },
      input.alsoLog,
      kidProfileId
    );
    return "dropped";
  }
  if (plan.action === "defer") {
    await recordOutcome(
      { ...outcomeBase, status: "deferred", error: plan.reason, notBefore: plan.notBefore },
      input.alsoLog,
      kidProfileId
    );
    return "deferred";
  }

  if (!apnsConfigured()) return "unconfigured";

  const { data: tokens } = await admin
    .from("device_push_tokens")
    .select("id, token, disabled_at")
    .eq("user_id", userId)
    .is("disabled_at", null);

  const active = (tokens ?? []) as TokenRow[];
  if (active.length === 0) return "skipped";

  await apnsJwt();
  let sent = 0;
  let lastError = "";
  for (const device of active) {
    try {
      const response = await postApns(device.token, {
        aps: {
          alert: { title, body: input.body },
          sound: "default",
        },
        url: input.url,
        type: input.type,
      });
      const reason = response.body ? (JSON.parse(response.body).reason as string | undefined) : undefined;
      if (response.status === 200) {
        sent += 1;
        continue;
      }
      lastError = reason || `HTTP ${response.status}`;
      if (response.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered") {
        await admin
          .from("device_push_tokens")
          .update({ disabled_at: new Date().toISOString() })
          .eq("id", device.id);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "APNs request failed";
    }
  }

  await recordOutcome(
    { ...outcomeBase, status: sent > 0 ? "sent" : "failed", error: sent > 0 ? null : lastError },
    input.alsoLog,
    kidProfileId
  );
  return sent > 0 ? "sent" : "failed";
}

export async function sendMergedPush(
  input: Omit<SendPushInput, "type" | "refKey"> & {
    entries: Array<{ type: string; refKey: string }>;
  }
): Promise<SendPushResult> {
  if (input.entries.length === 0) return "skipped";
  const primary = input.entries.find((entry) => !CAP_EXEMPT.has(entry.type)) ?? input.entries[0];
  const alsoLog = input.entries.filter((entry) => entry !== primary);
  return sendPush({ ...input, type: primary.type, refKey: primary.refKey, alsoLog });
}

/** Retry rows that were deferred until quiet hours or the cap lifted. */
export async function retryDeferredPushes(now = new Date()): Promise<number> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("push_send_log")
    .select("user_id, kid_profile_id, type, ref_key, title, body, url, expires_at, not_before")
    .eq("status", "deferred")
    .lte("not_before", now.toISOString())
    .limit(200);

  const groups = new Map<string, typeof data>();
  for (const row of data ?? []) {
    const key = `${row.user_id}|${row.title ?? ""}|${row.body ?? ""}|${row.url ?? ""}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let retried = 0;
  for (const rows of groups.values()) {
    const row = rows?.[0];
    if (!row?.title || !row.body || !row.url) continue;
    if (row.expires_at && new Date(row.expires_at as string).getTime() <= now.getTime()) {
      for (const item of rows ?? []) {
        await admin
          .from("push_send_log")
          .update({ status: "dropped", error: "no longer relevant", sent_at: now.toISOString() })
          .eq("user_id", item.user_id)
          .eq("type", item.type)
          .eq("ref_key", item.ref_key);
      }
      continue;
    }
    const refKey = String(row.ref_key);
    const kidId = (row.kid_profile_id as string | null) ?? null;
    const bareKey = kidId && refKey.endsWith(`:kid:${kidId}`) ? refKey.slice(0, -`:kid:${kidId}`.length) : refKey;
    const alsoLog = (rows ?? []).slice(1).map((item) => {
      const itemKey = String(item.ref_key);
      const itemKid = (item.kid_profile_id as string | null) ?? null;
      const bare = itemKid && itemKey.endsWith(`:kid:${itemKid}`)
        ? itemKey.slice(0, -`:kid:${itemKid}`.length)
        : itemKey;
      return { type: item.type as string, refKey: bare };
    });
    const result = await sendPush({
      userId: row.user_id as string,
      kidProfileId: kidId,
      type: row.type as string,
      refKey: bareKey,
      title: row.title as string,
      body: row.body as string,
      url: row.url as string,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
      alsoLog,
      skipKidPrefix: true,
      now,
    });
    if (result === "sent" || result === "dropped" || result === "failed") retried += 1;
  }
  return retried;
}
