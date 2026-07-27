import { NextResponse } from "next/server";
import { autoConfirmExpiredCoverAssignments } from "@/lib/calendar/tutor-cover";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

export const maxDuration = 60;

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { client, error: configError } = tryCreateServiceRoleClient();
  if (!client) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  try {
    const result = await autoConfirmExpiredCoverAssignments(client);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cover auto-confirm failed." },
      { status: 500 }
    );
  }
}
