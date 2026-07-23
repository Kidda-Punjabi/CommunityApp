import "server-only";

import {
  evaluateCohortCalendarGate,
  trySendCohortCalendarInvite,
} from "@/lib/group-purchase/cohort-calendar-invite";
import {
  hasOpenCohortWriteBackAttention,
  tryWriteBackCohortConfirmedAfterEnrollment,
} from "@/lib/notion/cohort-notion-writeback";
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
  const rawCohortId = params.session.metadata?.cohort_id?.trim();
  const rawHoldId = params.session.metadata?.cohort_seat_hold_id?.trim();

  if (!rawCohortId || !rawHoldId) {
    return { completed: false };
  }

  // Narrowed locals so nested closures see `string` (TS does not preserve
  // control-flow narrowing of outer unions inside nested functions).
  const cohortId: string = rawCohortId;
  const holdId: string = rawHoldId;

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

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, course_id, name, tutor_id, capacity, status, notion_page_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError) return { completed: false, error: cohortError.message };
  if (!cohort) return { completed: false, error: "Cohort not found." };

  async function writeBackNotionConfirmed(options?: { suppressDuplicateAttention?: boolean }) {
    const { data: authUser } = await supabase.auth.admin.getUserById(params.userId);
    await tryWriteBackCohortConfirmedAfterEnrollment(supabase, {
      userId: params.userId,
      cohortId,
      cohortName: cohort!.name,
      notionPageId: cohort!.notion_page_id ?? null,
      email: authUser.user?.email ?? null,
      suppressDuplicateAttention: options?.suppressDuplicateAttention,
    });
  }

  // Enrollment already on THIS cohort (e.g. reconcile after RPC fix) — still retry Notion
  // Confirmed write-back when a prior attempt left open attention (e.g. no_lead race).
  // Do NOT skip when the package is confirmed on a *different* cohort (re-test / switch).
  if (studentPackage.enrollment_id && studentPackage.status === "confirmed") {
    const { data: existingEnrollment } = await supabase
      .from("course_enrollments")
      .select("cohort_id")
      .eq("id", studentPackage.enrollment_id)
      .maybeSingle();

    if (existingEnrollment?.cohort_id === cohortId) {
      const needsWriteBackRetry = await hasOpenCohortWriteBackAttention(
        supabase,
        params.userId,
        cohortId
      );
      if (needsWriteBackRetry) {
        await writeBackNotionConfirmed({ suppressDuplicateAttention: true });
      }
      return { completed: true };
    }
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

  const paymentIntent =
    params.session.payment_intent != null ? String(params.session.payment_intent) : null;

  const { data: coreResult, error: rpcError } = await supabase.rpc("complete_group_purchase_core", {
    p_user_id: params.userId,
    p_student_package_id: params.studentPackageId,
    p_cohort_id: cohortId,
    p_hold_id: holdId,
    p_purchased_at: purchasedAt,
    p_payment_date: paymentDate,
    p_stripe_session_id: params.session.id,
    p_stripe_payment_intent: paymentIntent,
  });

  if (rpcError) {
    const tutorHint =
      cohort.tutor_id == null && rpcError.message.includes("tutor_id")
        ? " Run supabase/group-enrollment-null-tutor.sql if cohort has no tutor yet."
        : "";
    return {
      completed: false,
      error: `${rpcError.message}${tutorHint}`,
    };
  }

  const core = coreResult as {
    ok?: boolean;
    error?: string;
    already_completed?: boolean;
    enrollment_id?: string;
    cohort_name?: string;
    notion_page_id?: string | null;
  } | null;

  if (!core?.ok) {
    const message = core?.error ?? "Group purchase transaction failed.";
    const tutorHint =
      cohort.tutor_id == null && message.includes("tutor_id")
        ? " Run supabase/group-enrollment-null-tutor.sql if cohort has no tutor yet."
        : "";
    return { completed: false, error: `${message}${tutorHint}` };
  }

  if (core.already_completed) {
    const needsWriteBackRetry = await hasOpenCohortWriteBackAttention(
      supabase,
      params.userId,
      cohortId
    );
    if (needsWriteBackRetry) {
      await writeBackNotionConfirmed({ suppressDuplicateAttention: true });
    }
    return { completed: true };
  }

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

  const checklistExtras = {
    calendar_invite: calendarInvite,
    tutor_notified: tutorNotified,
  };

  if (existingChecklist) {
    await supabase
      .from("onboarding_checklists")
      .update(checklistExtras)
      .eq("id", existingChecklist.id);
  }

  // Lead create/link is awaited inside tryWriteBack → resolveLeadPageIdForCohortWriteBack
  // before any Confirmed PATCH — never fire write-back concurrently with lead resolution.
  const { data: authUser } = await supabase.auth.admin.getUserById(params.userId);
  await tryWriteBackCohortConfirmedAfterEnrollment(supabase, {
    userId: params.userId,
    cohortId,
    cohortName: core.cohort_name ?? cohort.name,
    notionPageId: core.notion_page_id ?? cohort.notion_page_id ?? null,
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
