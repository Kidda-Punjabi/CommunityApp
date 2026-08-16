import "server-only";

import { completeGroupPurchaseAfterPayment } from "@/lib/group-purchase/complete-group-purchase-after-payment";
import { cohortHoldExpiresAt } from "@/lib/group-purchase/cohort-capacity";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { packageSlugFromCheckoutKey } from "@/lib/stripe/sync-student-packages-from-payment";
import { KIDS_BEGINNERS_PACKAGE_SLUG } from "@/lib/learning/kids-beginners";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

const DEFAULT_KID_AVATAR = "Star";
const DEFAULT_KID_AGE_TIER = "independent";

function normalizeKidName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function kidNameFromSession(session: Stripe.Checkout.Session): string | null {
  const fromMeta = session.metadata?.kid_name?.trim();
  if (fromMeta) return fromMeta;
  const field = session.custom_fields?.find((item) => item.key === "kid_name");
  const value = field?.text?.value?.trim();
  return value || null;
}

export function isKidsCourseCheckoutSession(session: Stripe.Checkout.Session): boolean {
  if (session.metadata?.audience_type?.trim().toLowerCase() === "kids") return true;
  const checkoutKey = session.metadata?.checkout_key?.trim() ?? "";
  if (checkoutKey === "beginners-kids-group") return true;
  return Boolean(
    session.metadata?.kid_name?.trim() ||
      session.metadata?.kid_profile_id?.trim() ||
      kidNameFromSession(session)
  );
}

export async function findOrCreateKidProfileForPurchase(
  supabase: SupabaseClient,
  parentUserId: string,
  input: { kidProfileId?: string | null; kidName?: string | null }
): Promise<{ kidProfileId: string } | { error: string }> {
  if (input.kidProfileId?.trim()) {
    const { data, error } = await supabase
      .from("kid_profiles")
      .select("id")
      .eq("id", input.kidProfileId.trim())
      .eq("parent_user_id", parentUserId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data?.id) return { error: "Kid profile not found for this parent." };
    return { kidProfileId: data.id as string };
  }

  const name = input.kidName ? normalizeKidName(input.kidName) : "";
  if (!name) return { error: "Child's name is required." };

  const { data: existing, error: existingError } = await supabase
    .from("kid_profiles")
    .select("id, name")
    .eq("parent_user_id", parentUserId);

  if (existingError) return { error: existingError.message };

  const match = (existing ?? []).find(
    (row) => normalizeKidName(String(row.name ?? "")).toLowerCase() === name.toLowerCase()
  );
  if (match?.id) return { kidProfileId: match.id as string };

  const { data: created, error: createError } = await supabase
    .from("kid_profiles")
    .insert({
      parent_user_id: parentUserId,
      name,
      avatar_icon: DEFAULT_KID_AVATAR,
      age_tier: DEFAULT_KID_AGE_TIER,
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    return { error: createError?.message ?? "Could not create kid profile." };
  }
  return { kidProfileId: created.id as string };
}

export async function enqueueKidsCoursePurchaseGrant(
  supabase: SupabaseClient,
  input: {
    sessionId: string;
    parentEmail: string | null;
    parentUserId: string | null;
    kidName: string | null;
    kidProfileId: string | null;
    cohortId: string | null;
    reason: string;
    rawMetadata: Record<string, unknown>;
  }
): Promise<void> {
  const { data: existing } = await supabase
    .from("kids_course_purchase_grant_queue")
    .select("id")
    .eq("stripe_checkout_session_id", input.sessionId)
    .eq("resolved", false)
    .maybeSingle();

  const payload = {
    stripe_checkout_session_id: input.sessionId,
    parent_email: input.parentEmail,
    parent_user_id: input.parentUserId,
    kid_name: input.kidName,
    kid_profile_id: input.kidProfileId,
    cohort_id: input.cohortId,
    reason: input.reason,
    raw_metadata: input.rawMetadata,
    resolved: false,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("kids_course_purchase_grant_queue")
      .update(payload)
      .eq("id", existing.id);
    if (error) {
      console.error("[kids purchase grant] queue update failed:", error.message);
    }
    return;
  }

  const { error } = await supabase.from("kids_course_purchase_grant_queue").insert(payload);
  if (error) {
    console.error("[kids purchase grant] queue insert failed:", error.message);
  }
}

async function grantKidCourseAccess(
  supabase: SupabaseClient,
  kidProfileId: string,
  courseId: string
) {
  const { error: accessError } = await supabase.from("course_access").upsert(
    {
      user_id: null,
      kid_profile_id: kidProfileId,
      course_id: courseId,
      granted_at: new Date().toISOString(),
    },
    { onConflict: "kid_profile_id,course_id" }
  );
  if (accessError) return { error: accessError.message };

  const { data: course } = await supabase
    .from("courses")
    .select("required_tier")
    .eq("id", courseId)
    .maybeSingle();
  const courseTier = course?.required_tier?.trim().toLowerCase();
  if (courseTier === "foundational" || courseTier === "beginners" || courseTier === "community") {
    const { error: tierError } = await supabase.from("profile_course_access").upsert(
      {
        user_id: null,
        kid_profile_id: kidProfileId,
        course_tier: courseTier,
        granted_at: new Date().toISOString(),
      },
      { onConflict: "kid_profile_id,course_tier" }
    );
    if (tierError) return { error: tierError.message };
  }

  return {};
}

export async function grantKidsCoursePurchaseFromSession(
  session: Stripe.Checkout.Session,
  parentUserId: string | null
): Promise<{ granted: boolean; queued: boolean; error?: string }> {
  const supabase = createServiceRoleClient();
  const kidName = kidNameFromSession(session);
  const kidProfileIdMeta = session.metadata?.kid_profile_id?.trim() || null;
  const cohortId = session.metadata?.cohort_id?.trim() || null;
  const email =
    session.customer_details?.email ?? session.customer_email ?? null;

  if (!parentUserId) {
    await enqueueKidsCoursePurchaseGrant(supabase, {
      sessionId: session.id,
      parentEmail: email,
      parentUserId: null,
      kidName,
      kidProfileId: kidProfileIdMeta,
      cohortId,
      reason: "payment_before_signup",
      rawMetadata: (session.metadata ?? {}) as Record<string, unknown>,
    });
    console.error(
      "[kids purchase grant] queued — no parent account yet",
      "session=",
      session.id,
      "email=",
      email
    );
    return { granted: false, queued: true };
  }

  const kid = await findOrCreateKidProfileForPurchase(supabase, parentUserId, {
    kidProfileId: kidProfileIdMeta,
    kidName,
  });
  if ("error" in kid) {
    await enqueueKidsCoursePurchaseGrant(supabase, {
      sessionId: session.id,
      parentEmail: email,
      parentUserId,
      kidName,
      kidProfileId: kidProfileIdMeta,
      cohortId,
      reason: kid.error,
      rawMetadata: (session.metadata ?? {}) as Record<string, unknown>,
    });
    console.error("[kids purchase grant] kid profile failed:", kid.error, "session=", session.id);
    return { granted: false, queued: true, error: kid.error };
  }

  const checkoutKey = session.metadata?.checkout_key ?? null;
  let slug = checkoutKey ? packageSlugFromCheckoutKey(checkoutKey) : null;
  if (!slug && session.metadata?.audience_type?.trim().toLowerCase() === "kids") {
    slug = KIDS_BEGINNERS_PACKAGE_SLUG;
  }
  if (!slug && cohortId) {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("course_id, courses(content_track)")
      .eq("id", cohortId)
      .maybeSingle();
    const course = Array.isArray(cohort?.courses) ? cohort?.courses[0] : cohort?.courses;
    if ((course as { content_track?: string | null } | null)?.content_track === "kids") {
      slug = KIDS_BEGINNERS_PACKAGE_SLUG;
    }
  }
  if (!slug) {
    const message = "Unknown checkout product for kids purchase.";
    await enqueueKidsCoursePurchaseGrant(supabase, {
      sessionId: session.id,
      parentEmail: email,
      parentUserId,
      kidName,
      kidProfileId: kid.kidProfileId,
      cohortId,
      reason: message,
      rawMetadata: (session.metadata ?? {}) as Record<string, unknown>,
    });
    return { granted: false, queued: true, error: message };
  }

  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select("id, course_id")
    .eq("slug", slug)
    .maybeSingle();

  if (pkgError || !pkg) {
    const message = pkgError?.message ?? "Package not found.";
    await enqueueKidsCoursePurchaseGrant(supabase, {
      sessionId: session.id,
      parentEmail: email,
      parentUserId,
      kidName,
      kidProfileId: kid.kidProfileId,
      cohortId,
      reason: message,
      rawMetadata: (session.metadata ?? {}) as Record<string, unknown>,
    });
    return { granted: false, queued: true, error: message };
  }

  const purchasedAt = new Date(session.created * 1000).toISOString();
  const { data: studentPackage, error: spError } = await supabase
    .from("student_packages")
    .upsert(
      {
        user_id: null,
        kid_profile_id: kid.kidProfileId,
        package_id: pkg.id,
        course_id: pkg.course_id,
        status: "waiting_for_payment",
        purchased_at: purchasedAt,
        last_stripe_checkout_session_id: session.id,
      },
      { onConflict: "kid_profile_id,package_id" }
    )
    .select("id")
    .single();

  if (spError || !studentPackage) {
    const message = spError?.message ?? "Could not create student package.";
    await enqueueKidsCoursePurchaseGrant(supabase, {
      sessionId: session.id,
      parentEmail: email,
      parentUserId,
      kidName,
      kidProfileId: kid.kidProfileId,
      cohortId,
      reason: message,
      rawMetadata: (session.metadata ?? {}) as Record<string, unknown>,
    });
    return { granted: false, queued: true, error: message };
  }

  const access = await grantKidCourseAccess(
    supabase,
    kid.kidProfileId,
    pkg.course_id as string
  );
  if (access.error) {
    console.error("[kids purchase grant] course_access failed:", access.error);
  }

  if (cohortId) {
    let holdId = session.metadata?.cohort_seat_hold_id?.trim() || null;
    if (!holdId) {
      const { data: existingHold } = await supabase
        .from("cohort_seat_holds")
        .select("id")
        .eq("stripe_checkout_session_id", session.id)
        .maybeSingle();
      if (existingHold?.id) {
        holdId = existingHold.id as string;
      } else {
        const { data: hold, error: holdError } = await supabase
          .from("cohort_seat_holds")
          .insert({
            cohort_id: cohortId,
            user_id: parentUserId,
            expires_at: cohortHoldExpiresAt(),
            stripe_checkout_session_id: session.id,
          })
          .select("id")
          .single();
        if (holdError || !hold?.id) {
          const message = holdError?.message ?? "Could not reserve a cohort seat after payment.";
          await enqueueKidsCoursePurchaseGrant(supabase, {
            sessionId: session.id,
            parentEmail: email,
            parentUserId,
            kidName,
            kidProfileId: kid.kidProfileId,
            cohortId,
            reason: message,
            rawMetadata: (session.metadata ?? {}) as Record<string, unknown>,
          });
          return { granted: false, queued: true, error: message };
        }
        holdId = hold.id as string;
      }
    }

    const sessionForGrant = {
      ...session,
      metadata: {
        ...(session.metadata ?? {}),
        cohort_id: cohortId,
        cohort_seat_hold_id: holdId,
        checkout_key: checkoutKey ?? "beginners-kids-group",
      },
    } as Stripe.Checkout.Session;

    const groupResult = await completeGroupPurchaseAfterPayment(supabase, {
      userId: parentUserId,
      session: sessionForGrant,
      studentPackageId: studentPackage.id,
      kidProfileId: kid.kidProfileId,
    });
    if (groupResult.error) {
      await enqueueKidsCoursePurchaseGrant(supabase, {
        sessionId: session.id,
        parentEmail: email,
        parentUserId,
        kidName,
        kidProfileId: kid.kidProfileId,
        cohortId,
        reason: groupResult.error,
        rawMetadata: (session.metadata ?? {}) as Record<string, unknown>,
      });
      console.error(
        "[kids purchase grant] group placement failed:",
        groupResult.error,
        "session=",
        session.id
      );
      return { granted: false, queued: true, error: groupResult.error };
    }
  }

  await supabase
    .from("kids_course_purchase_grant_queue")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolution_note: "granted",
    })
    .eq("stripe_checkout_session_id", session.id)
    .eq("resolved", false);

  return { granted: true, queued: false };
}

export async function drainKidsCoursePurchaseGrantQueue(parentUserId: string, email: string) {
  const supabase = createServiceRoleClient();
  const normalized = email.trim().toLowerCase();
  const { data: rows, error } = await supabase
    .from("kids_course_purchase_grant_queue")
    .select("stripe_checkout_session_id")
    .eq("resolved", false)
    .ilike("parent_email", normalized);

  if (error) {
    console.error("[kids purchase grant] drain query failed:", error.message);
    return;
  }

  const { getStripe } = await import("@/lib/stripe/server");
  const stripe = getStripe();
  for (const row of rows ?? []) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        row.stripe_checkout_session_id as string
      );
      await grantKidsCoursePurchaseFromSession(session, parentUserId);
    } catch (e) {
      console.error(
        "[kids purchase grant] drain failed for",
        row.stripe_checkout_session_id,
        e instanceof Error ? e.message : e
      );
    }
  }
}
