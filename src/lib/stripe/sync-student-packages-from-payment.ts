import "server-only";

import {
  COMMUNITY_PACKAGE_SLUG,
  syncCommunityCourseAccess,
} from "@/lib/admin/community-package";
import type { PaidCourseTier } from "@/lib/membership/access";
import { packageSlugForEnrollment } from "@/lib/packages/catalog";
import { getCheckoutConfig } from "@/lib/products/checkout";
import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PurchaseForStudentPackage = {
  tier: PaidCourseTier;
  checkoutKey?: string | null;
  purchasedAt?: string;
  sessionId?: string | null;
  mode?: "payment" | "subscription";
  /** When true, only grant access — do not create or refresh onboarding. */
  skipOnboarding?: boolean;
};

export function packageSlugFromCheckoutKey(checkoutKey: string): string | null {
  if (checkoutKey === "foundational-refresher" || checkoutKey === "foundational-full") {
    return "foundational";
  }
  if (checkoutKey === "beginners-one-to-one") return "beginners-1-1";
  if (checkoutKey === "beginners-group" || checkoutKey === "beginners") return "beginners-group";
  if (checkoutKey === "beginners-kids-group") return "beginners-kids-group";
  if (checkoutKey === "community") return "community";
  const config = getCheckoutConfig(checkoutKey);
  if (!config) return null;
  if (config.productSlug === "foundational") return "foundational";
  if (config.productSlug === "community") return "community";
  if (config.productSlug === "beginners-kids") return "beginners-kids-group";
  if (checkoutKey.includes("one-to-one") || checkoutKey.includes("1-1")) return "beginners-1-1";
  if (config.productSlug === "beginners") return "beginners-group";
  return null;
}

function resolvePackageSlug(purchase: PurchaseForStudentPackage): string {
  const fromKey = purchase.checkoutKey ? packageSlugFromCheckoutKey(purchase.checkoutKey) : null;
  if (fromKey) return fromKey;

  if (purchase.tier === "foundational") return "foundational";
  if (purchase.tier === "community") return "community";
  return packageSlugForEnrollment(purchase.tier, "one_to_one");
}

function membershipStatusForSlug(slug: string): PackageMembershipStatus {
  return slug === COMMUNITY_PACKAGE_SLUG ? "confirmed" : "interested";
}

function checklistTypeForSlug(slug: string): "group" | "one_to_one" {
  return slug === "beginners-group" || slug === "beginners-kids-group"
    ? "group"
    : "one_to_one";
}

export async function ensureOnboardingChecklistForStudentPackage(
  supabase: SupabaseClient,
  studentPackageId: string,
  slug: string,
  purchasedAt: string,
  options?: { reset?: boolean; sessionId?: string | null }
) {
  if (slug === COMMUNITY_PACKAGE_SLUG) return;

  const paymentDate = purchasedAt.slice(0, 10);
  const checklistType = checklistTypeForSlug(slug);

  const { data: existing } = await supabase
    .from("onboarding_checklists")
    .select("id")
    .eq("student_package_id", studentPackageId)
    .maybeSingle();

  if (existing && !options?.reset) return;

  const checklistPayload = {
    student_package_id: studentPackageId,
    checklist_type: checklistType,
    payment_date: paymentDate,
    time_assigned: false,
    welcome_email: false,
    calendar_invite: false,
    tutor_notified: false,
    package_created: false,
    whatsapp_chat_made: false,
    schedule_whatsapp_chat: false,
    onboarding_completed: false,
    notes: null,
  };

  if (existing) {
    await supabase.from("onboarding_checklists").update(checklistPayload).eq("id", existing.id);
  } else {
    await supabase.from("onboarding_checklists").insert(checklistPayload);
  }

  if (options?.sessionId) {
    await supabase
      .from("student_packages")
      .update({ last_stripe_checkout_session_id: options.sessionId })
      .eq("id", studentPackageId);
  }
}

export async function markOnboardingPackageAssigned(
  supabase: SupabaseClient,
  studentPackageId: string
) {
  const { data: existing } = await supabase
    .from("onboarding_checklists")
    .select("id")
    .eq("student_package_id", studentPackageId)
    .maybeSingle();

  if (!existing) return;

  await supabase
    .from("onboarding_checklists")
    .update({ package_created: true })
    .eq("id", existing.id);
}

export async function upsertStudentPackageFromPurchase(
  supabase: SupabaseClient,
  userId: string,
  purchase: PurchaseForStudentPackage
): Promise<{ studentPackageId: string | null; error?: string }> {
  if (purchase.skipOnboarding) {
    return { studentPackageId: null };
  }

  const slug = resolvePackageSlug(purchase);
  const purchasedAt = purchase.purchasedAt ?? new Date().toISOString();
  const sessionId = purchase.sessionId ?? null;

  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select("id, course_id, slug, includes_live_sessions")
    .eq("slug", slug)
    .maybeSingle();

  if (pkgError) return { studentPackageId: null, error: pkgError.message };
  if (!pkg) return { studentPackageId: null, error: `Package product not found for slug “${slug}”.` };

  if (slug === COMMUNITY_PACKAGE_SLUG) {
    const status = membershipStatusForSlug(slug);
    const { data: row, error: upsertError } = await supabase
      .from("student_packages")
      .upsert(
        {
          user_id: userId,
          package_id: pkg.id,
          course_id: pkg.course_id,
          status,
          purchased_at: purchasedAt,
          last_stripe_checkout_session_id: sessionId,
        },
        { onConflict: "user_id,package_id" }
      )
      .select("id")
      .single();

    if (upsertError) return { studentPackageId: null, error: upsertError.message };

    const sync = await syncCommunityCourseAccess(supabase, userId, pkg.course_id, "confirmed");
    if (sync.error) return { studentPackageId: row.id, error: sync.error };
    return { studentPackageId: row.id };
  }

  const status = membershipStatusForSlug(slug);

  const { data: existing } = await supabase
    .from("student_packages")
    .select("id, status, last_stripe_checkout_session_id")
    .eq("user_id", userId)
    .eq("package_id", pkg.id)
    .maybeSingle();

  if (sessionId && existing?.last_stripe_checkout_session_id === sessionId) {
    return { studentPackageId: existing.id };
  }

  const isRenewalWithoutNewCheckout =
    purchase.mode === "subscription" && existing && !sessionId;

  if (isRenewalWithoutNewCheckout) {
    return { studentPackageId: existing.id };
  }

  const shouldPreserveConfirmed =
    existing?.status === "confirmed" && status === "interested";

  const isNewPayment = Boolean(sessionId && existing && existing.last_stripe_checkout_session_id !== sessionId);

  const { data: row, error: upsertError } = await supabase
    .from("student_packages")
    .upsert(
      {
        user_id: userId,
        package_id: pkg.id,
        course_id: pkg.course_id,
        status: shouldPreserveConfirmed ? "confirmed" : status,
        purchased_at: purchasedAt,
        last_stripe_checkout_session_id: sessionId,
      },
      { onConflict: "user_id,package_id" }
    )
    .select("id")
    .single();

  if (upsertError) return { studentPackageId: null, error: upsertError.message };

  await ensureOnboardingChecklistForStudentPackage(supabase, row.id, slug, purchasedAt, {
    reset: isNewPayment || !existing,
    sessionId,
  });

  return { studentPackageId: row.id };
}

export async function syncStudentPackagesFromPurchases(
  userId: string,
  purchases: PurchaseForStudentPackage[]
): Promise<{ synced: number; errors: string[] }> {
  if (purchases.length === 0) return { synced: 0, errors: [] };

  const supabase = createServiceRoleClient();
  const unique = new Map<string, PurchaseForStudentPackage>();

  for (const purchase of purchases) {
    const slug = resolvePackageSlug(purchase);
    const sessionKey = purchase.sessionId ?? `${purchase.tier}:${slug}:${purchase.purchasedAt ?? ""}`;
    unique.set(sessionKey, purchase);
  }

  let synced = 0;
  const errors: string[] = [];

  for (const purchase of unique.values()) {
    const result = await upsertStudentPackageFromPurchase(supabase, userId, purchase);
    if (result.error) errors.push(result.error);
    else if (result.studentPackageId) synced += 1;
  }

  return { synced, errors };
}
