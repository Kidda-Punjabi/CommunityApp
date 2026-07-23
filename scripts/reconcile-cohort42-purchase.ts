/**
 * One-off reconcile: finish Cohort 42 group purchase for hello@kidda.app
 * session cs_live_b1fxlhYolmjr624DUDgZuIqVvp4RPFK5yE1X2qbPKRRivLHjBSyzm7yxRK
 *
 * Root cause: complete_group_purchase treated any confirmed+enrollment as done,
 * so a prior Cohort 41 enrollment skipped Cohort 42 placement.
 *
 *   node --env-file=.env.local --import tsx scripts/reconcile-cohort42-purchase.ts
 */
import { createClient } from "@supabase/supabase-js";
import { completeGroupPurchaseAfterPayment } from "../src/lib/group-purchase/complete-group-purchase-after-payment";
import { getStripe } from "../src/lib/stripe/server";

const USER_ID = "b4755c02-e4be-4241-a66f-3d50fe0d33da";
const STUDENT_PACKAGE_ID = "8b1ca41c-86ab-4514-9273-b59169ee791c";
const COHORT_42_ID = "3103fd2c-f359-4503-a4d9-48a3af64327c";
const HOLD_ID = "c25fdabf-7b03-4e4b-97a9-de820863b3fb";
const SESSION_ID = "cs_live_b1fxlhYolmjr624DUDgZuIqVvp4RPFK5yE1X2qbPKRRivLHjBSyzm7yxRK";
const ENROLLMENT_ID = "e0914abf-5be3-442b-9ac1-8ae1499d8fb8";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: cohort, error: cohortError } = await admin
    .from("cohorts")
    .select("id, name, course_id, tutor_id, notion_page_id")
    .eq("id", COHORT_42_ID)
    .single();
  if (cohortError || !cohort) throw new Error(cohortError?.message ?? "Cohort 42 missing");

  const purchasedAt = "2026-07-23T08:45:36.000Z";
  const paymentDate = "2026-07-23";

  // Leave other active beginners memberships (C41 already left_at set).
  const { error: leaveError } = await admin
    .from("cohort_members")
    .update({ left_at: purchasedAt })
    .eq("user_id", USER_ID)
    .neq("cohort_id", COHORT_42_ID)
    .is("left_at", null);
  if (leaveError) throw new Error(`leave other cohorts: ${leaveError.message}`);

  const { error: memberError } = await admin.from("cohort_members").upsert(
    {
      cohort_id: COHORT_42_ID,
      user_id: USER_ID,
      joined_at: purchasedAt,
      left_at: null,
    },
    { onConflict: "cohort_id,user_id" }
  );
  if (memberError) throw new Error(`cohort_members: ${memberError.message}`);

  const { error: enrollmentError } = await admin
    .from("course_enrollments")
    .update({
      cohort_id: COHORT_42_ID,
      tutor_id: cohort.tutor_id,
      delivery_mode: "group",
      student_package_id: STUDENT_PACKAGE_ID,
      updated_at: purchasedAt,
    })
    .eq("id", ENROLLMENT_ID);
  if (enrollmentError) throw new Error(`enrollment: ${enrollmentError.message}`);

  const { error: packageError } = await admin
    .from("student_packages")
    .update({
      status: "confirmed",
      enrollment_id: ENROLLMENT_ID,
      last_stripe_checkout_session_id: SESSION_ID,
      purchased_at: purchasedAt,
    })
    .eq("id", STUDENT_PACKAGE_ID);
  if (packageError) throw new Error(`student_packages: ${packageError.message}`);

  const { error: holdError } = await admin.from("cohort_seat_holds").delete().eq("id", HOLD_ID);
  if (holdError) throw new Error(`hold delete: ${holdError.message}`);

  const { error: checklistError } = await admin
    .from("onboarding_checklists")
    .update({
      checklist_type: "group",
      payment_date: paymentDate,
      time_assigned: true,
      package_created: true,
    })
    .eq("student_package_id", STUDENT_PACKAGE_ID);
  if (checklistError) throw new Error(`checklist: ${checklistError.message}`);

  console.log("Core placement written for Cohort 42. Running calendar/Notion side effects…");

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(SESSION_ID);
  const result = await completeGroupPurchaseAfterPayment(admin, {
    userId: USER_ID,
    session,
    studentPackageId: STUDENT_PACKAGE_ID,
  });
  console.log("completeGroupPurchaseAfterPayment", result);

  const { data: en } = await admin
    .from("course_enrollments")
    .select("id, cohort_id, tutor_id")
    .eq("id", ENROLLMENT_ID)
    .single();
  const { data: members } = await admin
    .from("cohort_members")
    .select("*")
    .eq("cohort_id", COHORT_42_ID)
    .eq("user_id", USER_ID);
  const { data: holds } = await admin
    .from("cohort_seat_holds")
    .select("id")
    .eq("id", HOLD_ID);
  const { data: checklist } = await admin
    .from("onboarding_checklists")
    .select("time_assigned, package_created, calendar_invite, tutor_notified, payment_date")
    .eq("student_package_id", STUDENT_PACKAGE_ID)
    .maybeSingle();

  console.log("VERIFY", { enrollment: en, members, remainingHold: holds, checklist });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
