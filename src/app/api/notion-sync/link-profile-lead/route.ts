import { linkLeadsForProfile } from "@/lib/notion/lead-sync";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { NextResponse } from "next/server";

function isAuthorizedWebhook(request: Request): boolean {
  const secret = process.env.NOTION_SYNC_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-notion-sync-secret") === secret;
}

type SupabaseWebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  if (!isAuthorizedWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { client, error: configError } = tryCreateServiceRoleClient();
  if (!client) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = (await request.json()) as SupabaseWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (payload.table !== "profiles" || payload.type !== "INSERT" || !payload.record?.id) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const profileId = String(payload.record.id);
  const { data: authUser, error: authError } = await client.auth.admin.getUserById(profileId);
  if (authError || !authUser.user.email) {
    return NextResponse.json({ ok: true, skipped: "no_email" });
  }

  const record = payload.record;
  const fullName =
    (typeof record.full_name === "string" && record.full_name) ||
    (typeof record.preferred_name === "string" && record.preferred_name) ||
    null;

  const result = await linkLeadsForProfile(client, profileId, authUser.user.email, {
    fullName,
  });
  return NextResponse.json({ ok: true, ...result });
}
