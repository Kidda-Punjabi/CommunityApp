import { NextResponse } from "next/server";
import { syncTutorGoogleCalendar } from "@/lib/calendar/sync-tutor-calendar";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

export const maxDuration = 300;

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { client, error: configError } = tryCreateServiceRoleClient();
  if (!client) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  const { data: connections, error } = await client
    .from("tutor_google_calendar_connections")
    .select("tutor_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ tutorId: string; synced: number; skipped: number; error?: string }> = [];

  for (const connection of connections ?? []) {
    try {
      const result = await syncTutorGoogleCalendar(client, connection.tutor_id);
      results.push({ tutorId: connection.tutor_id, ...result });
    } catch (syncError) {
      results.push({
        tutorId: connection.tutor_id,
        synced: 0,
        skipped: 0,
        error: syncError instanceof Error ? syncError.message : "Sync failed.",
      });
    }
  }

  return NextResponse.json({
    tutors: results.length,
    results,
  });
}
