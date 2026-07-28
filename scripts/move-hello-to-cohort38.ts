/**
 * Move hello@kidda.app from Cohort 42 → Cohort 38.
 * Updates membership, enrollment, course access, calendar invites, Notion Confirmed.
 *
 *   node --env-file=.env.local --import tsx scripts/move-hello-to-cohort38.ts
 */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const USER_ID = "b4755c02-e4be-4241-a66f-3d50fe0d33da";
const EMAIL = "hello@kidda.app";
const STUDENT_PACKAGE_ID = "71114620-f8be-4c7c-af8f-c208694ac4df";
const ENROLLMENT_ID = "d73e2858-72a5-4371-82ce-2eb98121d0ff";
const COHORT_38_ID = "1c464e99-cc54-4523-bc44-2f4bfd01d165";
const COHORT_42_ID = "3103fd2c-f359-4503-a4d9-48a3af64327c";
const BEGINNERS_COURSE_ID = "155d5df5-c442-4e95-a908-2a16fa2e8c8d";

async function main() {
  const require = createRequire(import.meta.url);
  require("module").Module._cache[require.resolve("server-only")] = {
    id: require.resolve("server-only"),
    filename: require.resolve("server-only"),
    loaded: true,
    exports: {},
  };

  const {
    evaluateCohortCalendarGate,
    trySendCohortCalendarInvite,
  } = await import("../src/lib/group-purchase/cohort-calendar-invite.ts");
  const { getGoogleCalendarEvent } = await import("../src/lib/calendar/google-calendar-api.ts");
  const { getValidTutorAccessToken } = await import("../src/lib/calendar/tutor-access-token.ts");
  const {
    tryWriteBackCohortConfirmedAfterEnrollment,
    tryWriteBackCohortWithdrawalFromNotion,
  } = await import("../src/lib/notion/cohort-notion-writeback.ts");

  async function removeAttendeeFromGoogleCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    attendeeEmail: string
  ): Promise<boolean> {
    const normalized = attendeeEmail.trim().toLowerCase();
    const event = await getGoogleCalendarEvent(accessToken, calendarId, eventId);
    const existing = event.attendees ?? [];
    const next = existing.filter((a) => a.email?.trim().toLowerCase() !== normalized);
    if (next.length === existing.length) return false;

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ attendees: next }),
    });
    if (!res.ok) {
      throw new Error(`Google Calendar remove attendee failed: ${await res.text()}`);
    }
    return true;
  }

  async function tryRemoveCohortCalendarInvite(
    supabase: ReturnType<typeof createClient>,
    params: { cohortId: string; tutorId: string | null; studentEmail: string }
  ): Promise<{ removed: boolean; error?: string }> {
    const gate = await evaluateCohortCalendarGate(supabase, params.cohortId, params.tutorId);
    if (!gate.ready) return { removed: false };

    const { data: connection, error: connectionError } = await supabase
      .from("tutor_google_calendar_connections")
      .select(
        "tutor_id, google_account_email, calendar_id, access_token, refresh_token, token_expires_at"
      )
      .eq("tutor_id", gate.tutorId)
      .maybeSingle();

    if (connectionError || !connection) {
      return { removed: false, error: connectionError?.message ?? "No calendar connection." };
    }

    try {
      const accessToken = await getValidTutorAccessToken(supabase, connection);
      const removed = await removeAttendeeFromGoogleCalendarEvent(
        accessToken,
        gate.calendarId,
        gate.recurringEventId,
        params.studentEmail
      );
      return { removed };
    } catch (e) {
      return { removed: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();

  const { data: cohort38, error: c38Error } = await admin
    .from("cohorts")
    .select("id, name, course_id, tutor_id, notion_page_id, capacity")
    .eq("id", COHORT_38_ID)
    .single();
  if (c38Error || !cohort38) throw new Error(c38Error?.message ?? "Cohort 38 missing");

  const { data: cohort42 } = await admin
    .from("cohorts")
    .select("id, name, tutor_id, notion_page_id")
    .eq("id", COHORT_42_ID)
    .single();

  console.log("Moving", EMAIL, "→", cohort38.name, "tutor", cohort38.tutor_id);

  // Bump capacity if full so roster counts stay coherent after add.
  const { count: activeCount } = await admin
    .from("cohort_members")
    .select("*", { count: "exact", head: true })
    .eq("cohort_id", COHORT_38_ID)
    .is("left_at", null);
  const nextCapacity = Math.max(cohort38.capacity ?? 0, (activeCount ?? 0) + 1);
  if (nextCapacity !== cohort38.capacity) {
    const { error } = await admin
      .from("cohorts")
      .update({ capacity: nextCapacity })
      .eq("id", COHORT_38_ID);
    if (error) throw new Error(`capacity: ${error.message}`);
    console.log("capacity", cohort38.capacity, "→", nextCapacity);
  }

  // Leave other active beginners memberships.
  const { error: leaveError } = await admin
    .from("cohort_members")
    .update({ left_at: now })
    .eq("user_id", USER_ID)
    .neq("cohort_id", COHORT_38_ID)
    .is("left_at", null);
  if (leaveError) throw new Error(`leave other cohorts: ${leaveError.message}`);

  const { error: memberError } = await admin.from("cohort_members").upsert(
    {
      cohort_id: COHORT_38_ID,
      user_id: USER_ID,
      joined_at: now,
      left_at: null,
    },
    { onConflict: "cohort_id,user_id" }
  );
  if (memberError) throw new Error(`cohort_members: ${memberError.message}`);

  const { error: enrollmentError } = await admin
    .from("course_enrollments")
    .update({
      cohort_id: COHORT_38_ID,
      tutor_id: cohort38.tutor_id,
      delivery_mode: "group",
      course_id: BEGINNERS_COURSE_ID,
      student_package_id: STUDENT_PACKAGE_ID,
      updated_at: now,
    })
    .eq("id", ENROLLMENT_ID);
  if (enrollmentError) throw new Error(`enrollment: ${enrollmentError.message}`);

  const { error: packageError } = await admin
    .from("student_packages")
    .update({
      status: "confirmed",
      enrollment_id: ENROLLMENT_ID,
      course_id: BEGINNERS_COURSE_ID,
    })
    .eq("id", STUDENT_PACKAGE_ID);
  if (packageError) throw new Error(`student_packages: ${packageError.message}`);

  const { error: accessError } = await admin.from("course_access").upsert(
    {
      user_id: USER_ID,
      course_id: BEGINNERS_COURSE_ID,
      granted_at: now,
    },
    { onConflict: "user_id,course_id" }
  );
  if (accessError) throw new Error(`course_access: ${accessError.message}`);

  // Calendar: remove from C42, add to C38.
  let removedFromC42 = false;
  if (cohort42) {
    const remove = await tryRemoveCohortCalendarInvite(admin, {
      cohortId: COHORT_42_ID,
      tutorId: cohort42.tutor_id,
      studentEmail: EMAIL,
    });
    removedFromC42 = remove.removed;
    console.log("C42 calendar remove", remove);
  }

  const gate = await evaluateCohortCalendarGate(admin, COHORT_38_ID, cohort38.tutor_id);
  console.log("C38 calendar gate", gate);

  const invite = await trySendCohortCalendarInvite(admin, {
    cohortId: COHORT_38_ID,
    tutorId: cohort38.tutor_id,
    studentUserId: USER_ID,
  });
  console.log("C38 calendar invite", invite);

  if (invite.calendarInvite && cohort38.tutor_id) {
    await admin.from("notifications").insert({
      user_id: cohort38.tutor_id,
      type: "cohort_new_student",
      actor_user_id: USER_ID,
      payload: {
        cohort_id: COHORT_38_ID,
        cohort_name: cohort38.name,
        student_package_id: STUDENT_PACKAGE_ID,
      },
    });
  }

  await admin
    .from("onboarding_checklists")
    .update({
      checklist_type: "group",
      time_assigned: true,
      package_created: true,
      calendar_invite: Boolean(invite.calendarInvite),
      tutor_notified: Boolean(invite.calendarInvite),
    })
    .eq("student_package_id", STUDENT_PACKAGE_ID);

  // Notion: withdraw from C42 Confirmed, add to C38 Confirmed.
  if (cohort42) {
    const withdraw = await tryWriteBackCohortWithdrawalFromNotion(admin, {
      userId: USER_ID,
      cohortId: COHORT_42_ID,
    });
    console.log("Notion withdraw C42", withdraw);
  }

  const writeback = await tryWriteBackCohortConfirmedAfterEnrollment(admin, {
    userId: USER_ID,
    cohortId: COHORT_38_ID,
    cohortName: cohort38.name,
    notionPageId: cohort38.notion_page_id ?? null,
    email: EMAIL,
  });
  console.log("Notion confirm C38", writeback);

  // Verify
  const [{ data: members }, { data: enrollment }, { data: access }, { data: checklist }] =
    await Promise.all([
      admin
        .from("cohort_members")
        .select("cohort_id, left_at, cohorts(name)")
        .eq("user_id", USER_ID)
        .order("joined_at", { ascending: false }),
      admin
        .from("course_enrollments")
        .select("id, cohort_id, tutor_id, delivery_mode, student_package_id")
        .eq("id", ENROLLMENT_ID)
        .single(),
      admin
        .from("course_access")
        .select("course_id, granted_at")
        .eq("user_id", USER_ID)
        .eq("course_id", BEGINNERS_COURSE_ID)
        .maybeSingle(),
      admin
        .from("onboarding_checklists")
        .select("time_assigned, package_created, calendar_invite, tutor_notified")
        .eq("student_package_id", STUDENT_PACKAGE_ID)
        .maybeSingle(),
    ]);

  console.log(
    "VERIFY",
    JSON.stringify(
      {
        members,
        enrollment,
        access,
        checklist,
        removedFromC42,
        invitedToC38: invite.calendarInvite,
        notion: writeback,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
