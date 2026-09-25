import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueKidsCoursePurchaseGrant } from "@/lib/kids/grant-kids-course-purchase";
import {
  LEAD_HEAL_KIDS_COURSE_REASON,
  leadHealKidsQueueSessionId,
  pickLeadHealKidProfile,
} from "@/lib/kids/lead-heal-kids-grant-logic";

export { LEAD_HEAL_KIDS_COURSE_REASON };

export type LeadHealPackageTarget = {
  kind: "cohort" | "package_instance";
  runId: string;
  courseId: string;
  packageId: string;
  label: string;
  notionPageId: string;
};

type LeadHealMetadata = {
  kind?: "cohort" | "package_instance";
  runId?: string;
  courseId?: string;
  packageId?: string;
  label?: string;
  notionPageId?: string;
};

function readMetadata(value: unknown): LeadHealMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const kind = raw.kind === "cohort" || raw.kind === "package_instance" ? raw.kind : undefined;
  return {
    kind,
    runId: typeof raw.runId === "string" ? raw.runId : undefined,
    courseId: typeof raw.courseId === "string" ? raw.courseId : undefined,
    packageId: typeof raw.packageId === "string" ? raw.packageId : undefined,
    label: typeof raw.label === "string" ? raw.label : undefined,
    notionPageId: typeof raw.notionPageId === "string" ? raw.notionPageId : undefined,
  };
}

export async function enqueueLeadHealKidsCourse(
  supabase: SupabaseClient,
  profileId: string,
  target: LeadHealPackageTarget
): Promise<{ error?: string; email?: string; alreadySettled?: boolean }> {
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profileId);
  const email = authUser.user?.email?.trim().toLowerCase() || "";
  if (!email) {
    return { error: authError?.message ?? "Parent account has no email." };
  }

  const sessionId = leadHealKidsQueueSessionId(profileId, target.kind, target.runId);
  const { data: existing, error: existingError } = await supabase
    .from("kids_course_purchase_grant_queue")
    .select("id, resolved")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (existingError) return { error: existingError.message };
  if (existing?.resolved) return { email, alreadySettled: true };

  const rawMetadata = {
    source: "lead_heal",
    kind: target.kind,
    runId: target.runId,
    courseId: target.courseId,
    packageId: target.packageId,
    label: target.label,
    notionPageId: target.notionPageId,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("kids_course_purchase_grant_queue")
      .update({
        parent_email: email,
        parent_user_id: profileId,
        cohort_id: target.kind === "cohort" ? target.runId : null,
        reason: LEAD_HEAL_KIDS_COURSE_REASON,
        raw_metadata: rawMetadata,
        resolved: false,
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    return { email };
  }

  await enqueueKidsCoursePurchaseGrant(supabase, {
    sessionId,
    parentEmail: email,
    parentUserId: profileId,
    kidName: null,
    kidProfileId: null,
    cohortId: target.kind === "cohort" ? target.runId : null,
    reason: LEAD_HEAL_KIDS_COURSE_REASON,
    rawMetadata,
  });

  const { data: inserted, error: insertedError } = await supabase
    .from("kids_course_purchase_grant_queue")
    .select("id")
    .eq("stripe_checkout_session_id", sessionId)
    .eq("resolved", false)
    .maybeSingle();
  if (insertedError) return { error: insertedError.message };
  if (!inserted?.id) return { error: "Could not queue the kids course lead." };
  return { email };
}

type QueueRow = {
  id: string;
  parent_user_id: string | null;
  kid_name: string | null;
  kid_profile_id: string | null;
  cohort_id: string | null;
  raw_metadata: unknown;
};

async function grantLeadHealToKid(
  supabase: SupabaseClient,
  kidProfileId: string,
  meta: LeadHealMetadata,
  cohortId: string | null
): Promise<{ error?: string }> {
  if (!meta.kind || !meta.runId || !meta.courseId || !meta.packageId) {
    return { error: "Kids lead queue row is missing package details." };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, content_track")
    .eq("id", meta.courseId)
    .maybeSingle();
  if (courseError) return { error: courseError.message };
  if (course?.content_track !== "kids") {
    return { error: "Queued course is not on the kids track." };
  }

  const now = new Date().toISOString();

  if (meta.kind === "package_instance") {
    const { error } = await supabase.from("student_packages").upsert(
      {
        user_id: null,
        kid_profile_id: kidProfileId,
        package_id: meta.packageId,
        course_id: meta.courseId,
        package_instance_id: meta.runId,
        status: "confirmed",
        purchased_at: now,
      },
      { onConflict: "kid_profile_id,package_id" }
    );
    if (error) return { error: error.message };
  } else {
    const { data: cohort, error: cohortError } = await supabase
      .from("cohorts")
      .select("id, course_id, tutor_id")
      .eq("id", cohortId ?? meta.runId)
      .maybeSingle();
    if (cohortError) return { error: cohortError.message };
    if (!cohort || cohort.course_id !== meta.courseId) {
      return { error: "Queued cohort does not match the kids course." };
    }

    const { data: studentPackage, error: packageError } = await supabase
      .from("student_packages")
      .upsert(
        {
          user_id: null,
          kid_profile_id: kidProfileId,
          package_id: meta.packageId,
          course_id: meta.courseId,
          status: "confirmed",
          purchased_at: now,
        },
        { onConflict: "kid_profile_id,package_id" }
      )
      .select("id")
      .single();
    if (packageError || !studentPackage) {
      return { error: packageError?.message ?? "Could not create the kid package." };
    }

    const { error: memberError } = await supabase.from("cohort_members").upsert(
      {
        cohort_id: cohort.id,
        user_id: null,
        kid_profile_id: kidProfileId,
        joined_at: now,
        left_at: null,
      },
      { onConflict: "cohort_id,kid_profile_id" }
    );
    if (memberError) return { error: memberError.message };

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .upsert(
        {
          user_id: null,
          kid_profile_id: kidProfileId,
          course_id: meta.courseId,
          tutor_id: cohort.tutor_id,
          delivery_mode: "group",
          cohort_id: cohort.id,
          student_package_id: studentPackage.id,
          updated_at: now,
        },
        { onConflict: "kid_profile_id,course_id" }
      )
      .select("id")
      .single();
    if (enrollmentError || !enrollment) {
      return { error: enrollmentError?.message ?? "Could not enroll the kid profile." };
    }

    const { error: linkError } = await supabase
      .from("student_packages")
      .update({ enrollment_id: enrollment.id, status: "confirmed" })
      .eq("id", studentPackage.id);
    if (linkError) return { error: linkError.message };
  }

  const { error: accessError } = await supabase.from("course_access").upsert(
    {
      user_id: null,
      kid_profile_id: kidProfileId,
      course_id: meta.courseId,
      granted_at: now,
    },
    { onConflict: "kid_profile_id,course_id" }
  );
  if (accessError) return { error: accessError.message };

  return {};
}

export async function resolveLeadHealKidsQueueRow(
  supabase: SupabaseClient,
  parentUserId: string,
  row: QueueRow
): Promise<void> {
  if (row.parent_user_id && row.parent_user_id !== parentUserId) return;

  const { data: kids, error: kidsError } = await supabase
    .from("kid_profiles")
    .select("id, name")
    .eq("parent_user_id", parentUserId);
  if (kidsError) {
    console.error("[kids lead heal] kid profile lookup failed:", kidsError.message);
    return;
  }

  const pick = pickLeadHealKidProfile(
    (kids ?? []).map((kid) => ({ id: kid.id as string, name: String(kid.name ?? "") })),
    { kidProfileId: row.kid_profile_id, kidName: row.kid_name }
  );

  if (pick.status === "wait") return;

  if (pick.status === "ambiguous") {
    await supabase
      .from("kids_course_purchase_grant_queue")
      .update({ resolution_note: "ambiguous_multiple_kid_profiles" })
      .eq("id", row.id)
      .eq("resolved", false);
    return;
  }

  const meta = readMetadata(row.raw_metadata);
  const granted = await grantLeadHealToKid(supabase, pick.kidProfileId, meta, row.cohort_id);
  if (granted.error) {
    console.error("[kids lead heal] grant failed:", granted.error, "queue=", row.id);
    await supabase
      .from("kids_course_purchase_grant_queue")
      .update({ resolution_note: granted.error })
      .eq("id", row.id)
      .eq("resolved", false);
    return;
  }

  await supabase
    .from("kids_course_purchase_grant_queue")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolution_note: "granted_to_kid_profile",
      kid_profile_id: pick.kidProfileId,
    })
    .eq("id", row.id)
    .eq("resolved", false);
}
