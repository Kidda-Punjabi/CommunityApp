import { NextResponse } from "next/server";
import { syncTutorGoogleCalendar } from "@/lib/calendar/sync-tutor-calendar";
import { sendHomeworkDueReminders } from "@/lib/tutoring/homework-reminders";
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
    const tutorId = connection.tutor_id as string;
    try {
      console.info(`[cron calendar sync] start tutor=${tutorId}`);
      const result = await syncTutorGoogleCalendar(client, tutorId);
      console.info(
        `[cron calendar sync] ok tutor=${tutorId} synced=${result.synced}`
      );
      results.push({ tutorId, ...result });
    } catch (syncError) {
      const message =
        syncError instanceof Error ? syncError.message : "Sync failed.";
      console.error(`[cron calendar sync] failed tutor=${tutorId}:`, message);
      results.push({
        tutorId,
        synced: 0,
        skipped: 0,
        error: message,
      });
    }
  }

  const reminders = await sendHomeworkDueReminders(client);

  return NextResponse.json({
    tutors: results.length,
    results,
    homeworkDueReminders: reminders,
  });
}
