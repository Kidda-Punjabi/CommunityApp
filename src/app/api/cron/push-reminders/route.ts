import { NextResponse } from "next/server";
import { runPushReminders } from "@/lib/push/reminders";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

export const maxDuration = 120;

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { client, error } = tryCreateServiceRoleClient();
  if (!client) return NextResponse.json({ error }, { status: 500 });

  try {
    const counts = await runPushReminders(client);
    return NextResponse.json({ ok: true, ...counts });
  } catch (cronError) {
    const message = cronError instanceof Error ? cronError.message : "Push reminders failed.";
    console.error("[cron push]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
