import {
  pushSalesCallToNotion,
  salesCallSyncFieldsChanged,
} from "@/lib/notion/sales-call-sync";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { NextResponse } from "next/server";

type SupabaseWebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
};

function isAuthorizedWebhook(request: Request): boolean {
  const secret = process.env.NOTION_SYNC_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-notion-sync-secret") === secret;
}

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

  if (payload.table !== "sales_calls" || payload.schema !== "public") {
    return NextResponse.json({ ok: true, skipped: "wrong_table" });
  }

  if (payload.type === "DELETE" || !payload.record?.id) {
    return NextResponse.json({ ok: true, skipped: "delete_or_missing_record" });
  }

  if (
    payload.type === "UPDATE" &&
    !salesCallSyncFieldsChanged(payload.old_record, payload.record)
  ) {
    return NextResponse.json({ ok: true, skipped: "no_sync_fields_changed" });
  }

  const result = await pushSalesCallToNotion(client, String(payload.record.id));

  return NextResponse.json({
    ok: result.ok,
    salesCallId: payload.record.id,
    error: result.error,
    skippedTutorPerson: result.skippedTutorPerson ?? false,
  });
}
