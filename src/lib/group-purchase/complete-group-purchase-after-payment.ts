import "server-only";

import {
  evaluateCohortCalendarGate,
  trySendCohortCalendarInvite,
} from "@/lib/group-purchase/cohort-calendar-invite";
import { tryWriteBackCohortConfirmedAfterEnrollment } from "@/lib/notion/cohort-notion-writeback";
import { getCohortCheckoutRemainingSpots } from "@/lib/group-purchase/cohort-capacity";
import { packageSlugFromCheckoutKey } from "@/lib/stripe/sync-student-packages-from-payment";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

export type CompleteGroupPurchaseResult = {
  completed: boolean;
  placementPending?: boolean;
  error?: string;
};

async function notifyStudentPlacementPending(
  supabase: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>
) {
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "cohort_placement_pending",
    payload,
  });
}

async function notifyTutorNewStudent(
  supabase: SupabaseClient,
  tutorId: string,
  studentUserId: string,
  payload: Record<string, unknown>
) {
  await supabase.from("notifications").insert({
    user_id: tutorId,
    type: "cohort_new_student",
    actor_user_id: studentUserId,
    payload,
  });
}

export async function completeGroupPurchaseAfterPayment(
  supabase: SupabaseClient,
  params: {
    userId: string;
    session: Stripe.Checkout.Session;
    studentPackageId: string;
  }
): Promise<CompleteGroupPurchaseResult> {
  const cohortId = params.session.metadata?.cohort_id?.trim();
  const holdId = params.session.metadata?.cohort_seat_hold_id?.trim();
  const checkoutKey = params.session.metadata?.checkout_key ?? null;

  if (!cohortId || !holdId) {
    return { completed: false };
  }

  const { data: studentPackage, error: spLoadError } = await supabase
    .from("student_packages")
    .select("id, user_id, course_id, package_id, status, enrollment_id, packages(delivery_mode, slug)")
    .eq("id", params.studentPackageId)
    .maybeSingle();

  if (spLoadError) return { completed: false, error: spLoadError.message };
  if (!studentPackage || studentPackage.user_id !== params.userId) {
    return { completed: false, error: "Student package mismatch." };
  }

  const pkg = Array.isArray(studentPackage.packages)
    ? studentPackage.packages[0]
    : studentPackage.packages;

  if (pkg?.delivery_mode !== "group") {
    return { completed: false };
  }

  if (studentPackage.enrollment_id && studentPackage.status === "confirmed") {
    return { completed: true };
  }

  const { data: hold, error: holdError } = await supabase
    .from("cohort_seat_holds")
    .select("id, cohort_id, user_id, stripe_checkout_session_id")
    .eq("id", holdId)
    .maybeSingle();

  if (holdError) return { completed: false, error: holdError.message };
  if (!hold || hold.user_id !== params.userId || hold.cohort_id !== cohortId) {
    return { completed: false, error: "Cohort seat hold is invalid for this checkout." };
  }

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, course_id, name, tutor_id, capacity, status, notion_page_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError) return { completed: false, error: cohortError.message };
  if (!cohort) return { completed: false, error: "Cohort not found." };

  const capacity = cohort.capacity ?? 7;
  const remaining = await getCohortCheckoutRemainingSpots(supabase, cohortId, capacity, {
    honorHoldId: holdId,
  });

  if (remaining <= 0) {
    console.error(
      `Group cohort full at webhook: cohort=${cohortId} session=${params.session.id} user=${params.userId}`
    );

    await notifyStudentPlacementPending(supabase, params.userId, {
      cohort_id: cohortId,
      cohort_name: cohort.name,
      message:
        "Your payment went through — we’re confirming your cohort placement and will update you soon.",
    });

    return { completed: false, placementPending: true };
  }

  const purchasedAt = new Date(params.session.created * 1000).toISOString();
  const paymentDate = purchasedAt.slice(0, 10);

  const { error: memberError } = await supabase.from("cohort_members").upsert(
    {
      cohort_id: cohortId,
      user_id: params.userId,
      joined_at: purchasedAt,
      left_at: null,
    },
    { onConflict: "cohort_id,user_id" }
  );

  if (memberError) return { completed: false, error: memberError.message };

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("course_enrollments")
    .upsert(
      {
        user_id: params.userId,
        course_id: cohort.course_id,
        tutor_id: cohort.tutor_id,
        delivery_mode: "group",
        cohort_id: cohortId,
        student_package_id: params.studentPackageId,
        updated_at: purchasedAt,
      },
      { onConflict: "user_id,course_id" }
    )
    .select("id")
    .single();

  if (enrollmentError) return { completed: false, error: enrollmentError.message };

  const { error: spUpdateError } = await supabase
    .from("student_packages")
    .update({
      status: "confirmed",
      enrollment_id: enrollment.id,
      stripe_purchase_id: params.session.payment_intent
        ? String(params.session.payment_intent)
        : null,
      last_stripe_checkout_session_id: params.session.id,
      purchased_at: purchasedAt,
    })
    .eq("id", params.studentPackageId);

  if (spUpdateError) return { completed: false, error: spUpdateError.message };

  await supabase.from("cohort_seat_holds").delete().eq("id", holdId);

  const gate = await evaluateCohortCalendarGate(supabase, cohortId, cohort.tutor_id);
  let calendarInvite = false;
  let tutorNotified = false;

  if (gate.ready) {
    const invite = await trySendCohortCalendarInvite(supabase, {
      cohortId,
      tutorId: cohort.tutor_id,
      studentUserId: params.userId,
    });
    calendarInvite = invite.calendarInvite;

    if (calendarInvite && cohort.tutor_id) {
      await notifyTutorNewStudent(supabase, cohort.tutor_id, params.userId, {
        cohort_id: cohortId,
        cohort_name: cohort.name,
        student_package_id: params.studentPackageId,
      });
      tutorNotified = true;
    }
  }

  const { data: existingChecklist } = await supabase
    .from("onboarding_checklists")
    .select("id")
    .eq("student_package_id", params.studentPackageId)
    .maybeSingle();

  const checklistPayload = {
    checklist_type: "group" as const,
    payment_date: paymentDate,
    time_assigned: true,
    package_created: true,
    welcome_email: false,
    calendar_invite: calendarInvite,
    tutor_notified: tutorNotified,
    whatsapp_chat_made: false,
    schedule_whatsapp_chat: false,
    onboarding_completed: false,
  };

  if (existingChecklist) {
    await supabase
      .from("onboarding_checklists")
      .update(checklistPayload)
      .eq("id", existingChecklist.id);
  } else {
    await supabase.from("onboarding_checklists").insert({
      student_package_id: params.studentPackageId,
      ...checklistPayload,
    });
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(params.userId);
  await tryWriteBackCohortConfirmedAfterEnrollment(supabase, {
    userId: params.userId,
    cohortId,
    cohortName: cohort.name,
    notionPageId: cohort.notion_page_id ?? null,
    email: authUser.user?.email ?? null,
  });

  return { completed: true };
}

export async function completeGroupPurchaseFromCheckoutSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<CompleteGroupPurchaseResult> {
  const { getStripe } = await import("@/lib/stripe/server");
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const cohortId = session.metadata?.cohort_id;
  if (!cohortId) {
    return { completed: false };
  }

  const checkoutKey = session.metadata?.checkout_key ?? null;

  const slug = checkoutKey ? packageSlugFromCheckoutKey(checkoutKey) : null;
  let targetId: string | null = null;

  if (slug) {
    const { data: pkg } = await supabase.from("packages").select("id").eq("slug", slug).maybeSingle();
    if (pkg) {
      const { data: row } = await supabase
        .from("student_packages")
        .select("id")
        .eq("user_id", userId)
        .eq("package_id", pkg.id)
        .maybeSingle();
      targetId = row?.id ?? null;
    }
  }

  if (!targetId) {
    return { completed: false, error: "Student package row not found after payment sync." };
  }

  return completeGroupPurchaseAfterPayment(supabase, {
    userId,
    session,
    studentPackageId: targetId,
  });
}
