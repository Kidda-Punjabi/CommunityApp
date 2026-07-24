/**
 * Dry-run / live verification for 1-to-1 Google Calendar cancel follow-up.
 * TEST ACCOUNT ONLY: b4755c02-e4be-4241-a66f-3d50fe0d33da (hello@kidda.app)
 *
 * Usage:
 *   # Apply schema first, then:
 *   node --env-file=.env.local --import tsx scripts/verify-one-to-one-calendar-cancel.ts
 *   node --env-file=.env.local --import tsx scripts/verify-one-to-one-calendar-cancel.ts --apply
 *   # Token-failure simulation (does not call Google; forces error status):
 *   node --env-file=.env.local --import tsx scripts/verify-one-to-one-calendar-cancel.ts --apply --simulate-token-failure
 */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
require("module").Module._cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
};

const TEST_STUDENT_ID = "b4755c02-e4be-4241-a66f-3d50fe0d33da";
const apply = process.argv.includes("--apply");
const simulateTokenFailure = process.argv.includes("--simulate-token-failure");

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureSchema(admin: ReturnType<typeof adminClient>) {
  const { error } = await admin
    .from("tutor_scheduled_sessions")
    .select("calendar_sync_status, calendar_sync_error")
    .limit(1);
  if (!error) return true;

  if (!error.message.includes("calendar_sync_status")) {
    throw error;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error(
      "Schema missing calendar_sync_status. Apply supabase/tutor-scheduled-sessions-calendar-sync-status.sql (or set SUPABASE_ACCESS_TOKEN)."
    );
    return false;
  }

  const sql = readFileSync(
    resolve(process.cwd(), "supabase/tutor-scheduled-sessions-calendar-sync-status.sql"),
    "utf8"
  );
  const response = await fetch(
    `https://api.supabase.com/v1/projects/pztubczhqkzcwtkstpgi/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Schema apply failed (${response.status}): ${body.slice(0, 500)}`);
  }
  console.log("Applied calendar_sync_status schema.");
  return true;
}

async function main() {
  const admin = adminClient();
  console.log({
    apply,
    simulateTokenFailure,
    liveFlag: process.env.ONE_TO_ONE_GOOGLE_CALENDAR_CANCEL_LIVE_DELETE ?? "(unset = dry-run)",
  });

  const schemaOk = await ensureSchema(admin);
  if (!schemaOk) {
    console.warn(
      "Continuing without schema columns — dry-run will log to console only until SQL is applied."
    );
  }

  // Prefer an existing cancelled test booking that still has a Google event.
  const { data: booking } = await admin
    .from("tutor_one_to_one_bookings")
    .select("id, status, session_id, tutor_id, starts_at")
    .eq("student_id", TEST_STUDENT_ID)
    .not("session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!booking?.session_id) {
    throw new Error("No test-account booking with session_id found.");
  }

  const { data: sessionBefore } = await admin
    .from("tutor_scheduled_sessions")
    .select(
      "id, status, google_event_id, tutor_id, student_id, starts_at, cohort_id"
    )
    .eq("id", booking.session_id)
    .maybeSingle();

  if (!sessionBefore) throw new Error("Session not found.");
  if (sessionBefore.student_id !== TEST_STUDENT_ID) {
    throw new Error("Refusing: session student_id is not the test account.");
  }
  if (sessionBefore.cohort_id) {
    throw new Error("Refusing: cohort-linked session.");
  }

  let calendarSyncBefore: { calendar_sync_status: string | null; calendar_sync_error: string | null } | null =
    null;
  if (schemaOk) {
    const { data } = await admin
      .from("tutor_scheduled_sessions")
      .select("calendar_sync_status, calendar_sync_error")
      .eq("id", booking.session_id)
      .maybeSingle();
    calendarSyncBefore = data;
  }

  console.log("Target booking/session:", {
    bookingId: booking.id,
    bookingStatus: booking.status,
    sessionId: sessionBefore.id,
    googleEventId: sessionBefore.google_event_id,
    startsAt: sessionBefore.starts_at,
    calendarSyncStatus: calendarSyncBefore?.calendar_sync_status ?? "(schema not applied)",
  });

  if (!apply) {
    console.log("DRY SCRIPT — pass --apply to re-confirm booking then cancel through production path.");
    return;
  }

  // Re-arm a previously cancelled test booking so cancelConfirmedOneToOneBooking can run.
  const { data: credit } = await admin
    .from("tutor_one_to_one_booking_credits")
    .select("id")
    .eq("student_id", TEST_STUDENT_ID)
    .eq("status", "available")
    .limit(1)
    .maybeSingle();

  if (!credit) throw new Error("No available credit on test account to re-arm booking.");

  const now = new Date().toISOString();
  const sessionReset: Record<string, unknown> = {
    status: "scheduled",
    updated_at: now,
  };
  if (schemaOk) {
    sessionReset.calendar_sync_status = null;
    sessionReset.calendar_sync_error = null;
  }
  await admin.from("tutor_scheduled_sessions").update(sessionReset).eq("id", sessionBefore.id);

  await admin
    .from("tutor_one_to_one_bookings")
    .update({ status: "confirmed", updated_at: now })
    .eq("id", booking.id)
    .eq("student_id", TEST_STUDENT_ID);

  await admin
    .from("tutor_one_to_one_booking_credits")
    .update({
      status: "used",
      booking_id: booking.id,
      used_at: now,
    })
    .eq("id", credit.id);

  const { cancelConfirmedOneToOneBooking } = await import(
    "../src/lib/tutoring/cancel-one-to-one-booking"
  );
  const cancelResult = await cancelConfirmedOneToOneBooking(admin, {
    bookingId: booking.id,
    studentId: TEST_STUDENT_ID,
  });
  console.log("cancelConfirmedOneToOneBooking:", cancelResult);
  if (!cancelResult.ok) {
    process.exit(1);
  }

  if (simulateTokenFailure) {
    // Booking/credit cancel already committed above. Break OAuth briefly, run live
    // calendar follow-up, then restore tokens so the tutor connection stays intact.
    process.env.ONE_TO_ONE_GOOGLE_CALENDAR_CANCEL_LIVE_DELETE = "true";
    const { data: conn } = await admin
      .from("tutor_google_calendar_connections")
      .select("tutor_id, access_token, refresh_token, token_expires_at")
      .eq("tutor_id", sessionBefore.tutor_id)
      .maybeSingle();
    if (!conn) throw new Error("Tutor calendar connection missing for token-failure sim.");

    await admin
      .from("tutor_google_calendar_connections")
      .update({
        refresh_token: "invalid-refresh-token-for-sim",
        token_expires_at: new Date(Date.now() - 60_000).toISOString(),
      })
      .eq("tutor_id", conn.tutor_id);

    try {
      const { cancelOneToOneSessionGoogleCalendarEvent } = await import(
        "../src/lib/tutoring/cancel-one-to-one-calendar-event"
      );
      const calendarResult = await cancelOneToOneSessionGoogleCalendarEvent(
        admin,
        cancelResult.cancelledSessionId!
      );
      console.log("calendar follow-up (expected error):", calendarResult);
    } finally {
      await admin
        .from("tutor_google_calendar_connections")
        .update({
          access_token: conn.access_token,
          refresh_token: conn.refresh_token,
          token_expires_at: conn.token_expires_at,
        })
        .eq("tutor_id", conn.tutor_id);
      console.log("Restored tutor Google Calendar tokens.");
    }

    const { data: bookingAfter } = await admin
      .from("tutor_one_to_one_bookings")
      .select("status")
      .eq("id", booking.id)
      .maybeSingle();
    const { data: creditsAfter } = await admin
      .from("tutor_one_to_one_booking_credits")
      .select("id, status, booking_id")
      .eq("student_id", TEST_STUDENT_ID);
    const { data: sessionAfter } = await admin
      .from("tutor_scheduled_sessions")
      .select("status, google_event_id")
      .eq("id", sessionBefore.id)
      .maybeSingle();
    let calendarSyncAfter: Record<string, unknown> | null = null;
    if (schemaOk) {
      const { data } = await admin
        .from("tutor_scheduled_sessions")
        .select("calendar_sync_status, calendar_sync_error")
        .eq("id", sessionBefore.id)
        .maybeSingle();
      calendarSyncAfter = data;
    }

    console.log("Token-failure simulation result:", {
      bookingStatus: bookingAfter?.status,
      credits: creditsAfter,
      session: { ...sessionAfter, ...calendarSyncAfter },
    });
    return;
  }

  const { cancelOneToOneSessionGoogleCalendarEvent, isOneToOneGoogleCalendarCancelLiveDeleteEnabled } =
    await import("../src/lib/tutoring/cancel-one-to-one-calendar-event");

  const calendarResult = await cancelOneToOneSessionGoogleCalendarEvent(
    admin,
    cancelResult.cancelledSessionId!
  );
  console.log("calendar follow-up:", calendarResult);
  console.log("liveDeleteEnabled:", isOneToOneGoogleCalendarCancelLiveDeleteEnabled());

  const { data: sessionAfter } = await admin
    .from("tutor_scheduled_sessions")
    .select("id, status, google_event_id, tutor_id, student_id, starts_at")
    .eq("id", sessionBefore.id)
    .maybeSingle();

  let calendarSyncAfter: { calendar_sync_status: string | null; calendar_sync_error: string | null } | null =
    null;
  if (schemaOk) {
    const { data } = await admin
      .from("tutor_scheduled_sessions")
      .select("calendar_sync_status, calendar_sync_error")
      .eq("id", sessionBefore.id)
      .maybeSingle();
    calendarSyncAfter = data;
  }

  console.log("session after:", { ...sessionAfter, ...calendarSyncAfter });

  // Confirm Google event still present when dry-run.
  if (!isOneToOneGoogleCalendarCancelLiveDeleteEnabled()) {
    const { getValidTutorAccessToken } = await import("../src/lib/calendar/tutor-access-token");
    const { getGoogleCalendarEvent } = await import("../src/lib/calendar/google-calendar-api");
    const { data: conn } = await admin
      .from("tutor_google_calendar_connections")
      .select("*")
      .eq("tutor_id", sessionBefore.tutor_id)
      .maybeSingle();
    if (conn) {
      const token = await getValidTutorAccessToken(admin, conn);
      try {
        const ev = await getGoogleCalendarEvent(
          token,
          conn.calendar_id,
          sessionBefore.google_event_id
        );
        console.log("Google Calendar event STILL PRESENT (expected in dry-run):", ev.id);
      } catch (error) {
        console.error(
          "Google Calendar event missing unexpectedly in dry-run:",
          error instanceof Error ? error.message : error
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
