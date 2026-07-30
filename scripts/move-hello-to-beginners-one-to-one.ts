/**
 * Move hello@kidda.app off Cohort 38 → Beginners 1-to-1.
 * Updates membership, enrollment, packages, calendar, Notion.
 *
 *   node --env-file=.env.local --import tsx scripts/move-hello-to-beginners-one-to-one.ts
 */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const USER_ID = "b4755c02-e4be-4241-a66f-3d50fe0d33da";
const EMAIL = "hello@kidda.app";
const GROUP_STUDENT_PACKAGE_ID = "71114620-f8be-4c7c-af8f-c208694ac4df";
const ENROLLMENT_ID = "d73e2858-72a5-4371-82ce-2eb98121d0ff";
const COHORT_38_ID = "1c464e99-cc54-4523-bc44-2f4bfd01d165";
const BEGINNERS_COURSE_ID = "155d5df5-c442-4e95-a908-2a16fa2e8c8d";
const BEGINNERS_ONE_TO_ONE_PACKAGE_ID = "5d861424-3eba-4317-9f14-a0ea755e5b1d";
const TUTOR_ID = "9967ceda-f077-4430-83b5-3198db006550";

async function main() {
  const require = createRequire(import.meta.url);
  require("module").Module._cache[require.resolve("server-only")] = {
    id: require.resolve("server-only"),
    filename: require.resolve("server-only"),
    loaded: true,
    exports: {},
  };

  const { getGoogleCalendarEvent } = await import("../src/lib/calendar/google-calendar-api.ts");
  const { getValidTutorAccessToken } = await import("../src/lib/calendar/tutor-access-token.ts");
  const { evaluateCohortCalendarGate } = await import(
    "../src/lib/group-purchase/cohort-calendar-invite.ts"
  );
  const { tryWriteBackCohortWithdrawalFromNotion } = await import(
    "../src/lib/notion/cohort-notion-writeback.ts"
  );
  const { ensureOnboardingChecklistForStudentPackage, markOnboardingPackageAssigned } =
    await import("../src/lib/stripe/sync-student-packages-from-payment.ts");

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
    .select("id, name, course_id, tutor_id, notion_page_id")
    .eq("id", COHORT_38_ID)
    .single();
  if (c38Error || !cohort38) throw new Error(c38Error?.message ?? "Cohort 38 missing");

  console.log("Moving", EMAIL, "off", cohort38.name, "→ Beginners 1-to-1, tutor", TUTOR_ID);

  // 1. Leave Cohort 38.
  const { error: leaveError } = await admin
    .from("cohort_members")
    .update({ left_at: now })
    .eq("cohort_id", COHORT_38_ID)
    .eq("user_id", USER_ID)
    .is("left_at", null);
  if (leaveError) throw new Error(`leave cohort: ${leaveError.message}`);

  // 2. Switch enrollment to 1-to-1 (cohort_id must be null after leaving).
  const { error: enrollmentError } = await admin
    .from("course_enrollments")
    .update({
      cohort_id: null,
      tutor_id: TUTOR_ID,
      delivery_mode: "one_to_one",
      course_id: BEGINNERS_COURSE_ID,
      updated_at: now,
    })
    .eq("id", ENROLLMENT_ID);
  if (enrollmentError) throw new Error(`enrollment: ${enrollmentError.message}`);

  // 3. Withdraw the group student package.
  const { error: withdrawError } = await admin
    .from("student_packages")
    .update({ status: "withdrawn", enrollment_id: null })
    .eq("id", GROUP_STUDENT_PACKAGE_ID);
  if (withdrawError) throw new Error(`withdraw group package: ${withdrawError.message}`);

  // 4. Create a 1-to-1 package instance.
  const instanceName = "Hello - 1-1 Beginner Course";
  const { data: instance, error: instanceError } = await admin
    .from("package_instances")
    .insert({
      package_id: BEGINNERS_ONE_TO_ONE_PACKAGE_ID,
      course_id: BEGINNERS_COURSE_ID,
      tutor_id: TUTOR_ID,
      name: instanceName,
      status: "pre_scheduling",
      capacity: 1,
      active: true,
    })
    .select("id")
    .single();
  if (instanceError || !instance) {
    throw new Error(instanceError?.message ?? "Failed to create package instance.");
  }
  console.log("Created package instance", instance.id, instanceName);

  // 5. Upsert the 1-to-1 student package.
  const { data: oneToOnePackage, error: oneToOneError } = await admin
    .from("student_packages")
    .upsert(
      {
        user_id: USER_ID,
        package_id: BEGINNERS_ONE_TO_ONE_PACKAGE_ID,
        course_id: BEGINNERS_COURSE_ID,
        package_instance_id: instance.id,
        enrollment_id: null,
        status: "confirmed",
        purchased_at: now,
      },
      { onConflict: "user_id,package_id" }
    )
    .select("id")
    .single();
  if (oneToOneError || !oneToOnePackage) {
    throw new Error(oneToOneError?.message ?? "Failed to upsert 1-to-1 student package.");
  }

  // 6. Link enrollment to the new package row.
  const { error: linkEnrollmentError } = await admin
    .from("course_enrollments")
    .update({
      student_package_id: oneToOnePackage.id,
      updated_at: now,
    })
    .eq("id", ENROLLMENT_ID);
  if (linkEnrollmentError) throw new Error(`link enrollment: ${linkEnrollmentError.message}`);

  // 7. Keep course access.
  const { error: accessError } = await admin.from("course_access").upsert(
    {
      user_id: USER_ID,
      course_id: BEGINNERS_COURSE_ID,
      granted_at: now,
    },
    { onConflict: "user_id,course_id" }
  );
  if (accessError) throw new Error(`course_access: ${accessError.message}`);

  // 8. Calendar: remove from Cohort 38.
  const calendarRemove = await tryRemoveCohortCalendarInvite(admin, {
    cohortId: COHORT_38_ID,
    tutorId: cohort38.tutor_id,
    studentEmail: EMAIL,
  });
  console.log("C38 calendar remove", calendarRemove);

  // 9. Onboarding checklist for 1-to-1 package.
  await ensureOnboardingChecklistForStudentPackage(
    admin,
    oneToOnePackage.id,
    "beginners-1-1",
    now,
    { reset: true }
  );
  await markOnboardingPackageAssigned(admin, oneToOnePackage.id);

  // 10. Mark group checklist as no longer active (leave row for history).
  await admin
    .from("onboarding_checklists")
    .update({ checklist_type: "group", onboarding_completed: false })
    .eq("student_package_id", GROUP_STUDENT_PACKAGE_ID);

  // 11. Notion: withdraw from Cohort 38 Confirmed.
  const notionWithdraw = await tryWriteBackCohortWithdrawalFromNotion(admin, {
    userId: USER_ID,
    cohortId: COHORT_38_ID,
  });
  console.log("Notion withdraw C38", notionWithdraw);

  // Verify
  const [{ data: members }, { data: enrollment }, { data: packages }, { data: access }, { data: checklist }] =
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
        .from("student_packages")
        .select("id, status, package_id, package_instance_id, packages(name, delivery_mode)")
        .eq("user_id", USER_ID)
        .eq("course_id", BEGINNERS_COURSE_ID),
      admin
        .from("course_access")
        .select("course_id, granted_at")
        .eq("user_id", USER_ID)
        .eq("course_id", BEGINNERS_COURSE_ID)
        .maybeSingle(),
      admin
        .from("onboarding_checklists")
        .select("student_package_id, checklist_type, package_created, time_assigned")
        .eq("student_package_id", oneToOnePackage.id)
        .maybeSingle(),
    ]);

  console.log(
    "VERIFY",
    JSON.stringify(
      {
        members,
        enrollment,
        packages,
        access,
        checklist,
        packageInstanceId: instance.id,
        calendarRemove,
        notionWithdraw,
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
