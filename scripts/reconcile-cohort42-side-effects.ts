/**
 * Finish calendar + Notion side effects after Cohort 42 core placement.
 *   node --env-file=.env.local --import tsx scripts/reconcile-cohort42-side-effects.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  evaluateCohortCalendarGate,
  trySendCohortCalendarInvite,
} from "../src/lib/group-purchase/cohort-calendar-invite";
import { tryWriteBackCohortConfirmedAfterEnrollment } from "../src/lib/notion/cohort-notion-writeback";

const USER_ID = "b4755c02-e4be-4241-a66f-3d50fe0d33da";
const STUDENT_PACKAGE_ID = "8b1ca41c-86ab-4514-9273-b59169ee791c";
const COHORT_42_ID = "3103fd2c-f359-4503-a4d9-48a3af64327c";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: cohort } = await admin
    .from("cohorts")
    .select("id, name, tutor_id, notion_page_id")
    .eq("id", COHORT_42_ID)
    .single();
  if (!cohort) throw new Error("Cohort 42 missing");

  const gate = await evaluateCohortCalendarGate(admin, COHORT_42_ID, cohort.tutor_id);
  console.log("calendar gate", gate);

  let calendarInvite = false;
  let tutorNotified = false;

  if (gate.ready) {
    const invite = await trySendCohortCalendarInvite(admin, {
      cohortId: COHORT_42_ID,
      tutorId: cohort.tutor_id,
      studentUserId: USER_ID,
    });
    calendarInvite = invite.calendarInvite;
    console.log("calendar invite", invite);

    if (calendarInvite && cohort.tutor_id) {
      await admin.from("notifications").insert({
        user_id: cohort.tutor_id,
        type: "cohort_new_student",
        actor_user_id: USER_ID,
        payload: {
          cohort_id: COHORT_42_ID,
          cohort_name: cohort.name,
          student_package_id: STUDENT_PACKAGE_ID,
        },
      });
      tutorNotified = true;
    }
  }

  await admin
    .from("onboarding_checklists")
    .update({
      calendar_invite: calendarInvite,
      tutor_notified: tutorNotified,
    })
    .eq("student_package_id", STUDENT_PACKAGE_ID);

  const { data: authUser } = await admin.auth.admin.getUserById(USER_ID);
  const writeback = await tryWriteBackCohortConfirmedAfterEnrollment(admin, {
    userId: USER_ID,
    cohortId: COHORT_42_ID,
    cohortName: cohort.name,
    notionPageId: cohort.notion_page_id ?? null,
    email: authUser.user?.email ?? null,
  });
  console.log("notion writeback", writeback);

  const { data: checklist } = await admin
    .from("onboarding_checklists")
    .select("time_assigned, package_created, calendar_invite, tutor_notified")
    .eq("student_package_id", STUDENT_PACKAGE_ID)
    .maybeSingle();
  console.log("checklist", checklist);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
