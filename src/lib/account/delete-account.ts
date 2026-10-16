import "server-only";

import { isAdmin } from "@/lib/auth/admin";
import {
  accountDeletionBlockedReason,
  normalizeDeleteConfirmation,
} from "@/lib/account/deletion-policy";
import { sendAccountDeletionNotifyEmail } from "@/lib/email/send-account-deletion-notify";
import { getStripe } from "@/lib/stripe/server";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type MembershipRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  tier_name: string;
  created_at: string;
  updated_at: string;
};

type PackageRow = {
  id: string;
  user_id: string | null;
  kid_profile_id: string | null;
  package_id: string;
  course_id: string;
  status: string;
  stripe_purchase_id: string | null;
  last_stripe_checkout_session_id: string | null;
  purchased_at: string | null;
  enrollment_id: string | null;
  package_instance_id: string | null;
};

const CANCEL_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);

function withoutUser(row: object): Record<string, unknown> {
  const copy = { ...(row as Record<string, unknown>) };
  delete copy.user_id;
  delete copy.kid_profile_id;
  return copy;
}

async function removeStorageObjects(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  extra: Array<{ bucket: string; path: string }>
) {
  const grouped = new Map<string, Set<string>>();
  function add(bucket: string, path: string) {
    const name = path.trim();
    if (!bucket || !name) return;
    const paths = grouped.get(bucket) ?? new Set<string>();
    paths.add(name);
    grouped.set(bucket, paths);
  }

  const listed = await admin.rpc("list_storage_objects_for_user", { target: userId });
  if (!listed.error) {
    for (const row of (listed.data ?? []) as Array<{ bucket_id: string; name: string }>) {
      add(row.bucket_id, row.name);
    }
  }

  for (const item of extra) add(item.bucket, item.path);

  const { data: avatars } = await admin.storage.from("avatars").list(userId);
  for (const file of avatars ?? []) {
    if (file.name) add("avatars", `${userId}/${file.name}`);
  }

  for (const [bucket, paths] of grouped) {
    const names = [...paths];
    for (let index = 0; index < names.length; index += 100) {
      await admin.storage.from(bucket).remove(names.slice(index, index + 100));
    }
  }
}

async function cancelStripeSubscriptions(customerIds: string[], subscriptionIds: string[]) {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) return subscriptionIds;
  const stripe = getStripe();
  const cancelled = new Set(subscriptionIds.filter(Boolean));

  for (const customerId of customerIds) {
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    for (const subscription of subscriptions.data) {
      if (!CANCEL_STATUSES.has(subscription.status)) continue;
      await stripe.subscriptions.cancel(subscription.id);
      cancelled.add(subscription.id);
    }
  }

  for (const subscriptionId of subscriptionIds) {
    if (!subscriptionId || cancelled.has(subscriptionId)) continue;
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (CANCEL_STATUSES.has(subscription.status)) {
        await stripe.subscriptions.cancel(subscription.id);
        cancelled.add(subscription.id);
      }
    } catch {
      // A missing subscription is already gone from Stripe.
    }
  }

  return [...cancelled];
}

export async function deleteCurrentAccount(
  confirmation: string
): Promise<{ error?: string; deleted?: true }> {
  if (!normalizeDeleteConfirmation(confirmation)) {
    return { error: "Type DELETE to confirm." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const admin = createServiceRoleClient();
  const blocked = await staffBlockReason(admin, user);
  if (blocked) return { error: blocked };

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select(
      "id, user_id, stripe_customer_id, stripe_subscription_id, status, tier_name, created_at, updated_at"
    )
    .eq("user_id", user.id);
  if (membershipError) return { error: membershipError.message };

  const { data: kidRows } = await admin.from("kid_profiles").select("id").eq("parent_user_id", user.id);
  const kidIds = (kidRows ?? []).map((row) => row.id as string);

  const { data: ownPackages, error: packageError } = await admin
    .from("student_packages")
    .select(
      "id, user_id, kid_profile_id, package_id, course_id, status, stripe_purchase_id, last_stripe_checkout_session_id, purchased_at, enrollment_id, package_instance_id"
    )
    .eq("user_id", user.id);
  if (packageError) return { error: packageError.message };

  let kidPackages: PackageRow[] = [];
  if (kidIds.length > 0) {
    const kidPackageResult = await admin
      .from("student_packages")
      .select(
        "id, user_id, kid_profile_id, package_id, course_id, status, stripe_purchase_id, last_stripe_checkout_session_id, purchased_at, enrollment_id, package_instance_id"
      )
      .in("kid_profile_id", kidIds);
    if (kidPackageResult.error) return { error: kidPackageResult.error.message };
    kidPackages = (kidPackageResult.data ?? []) as PackageRow[];
  }

  const packages = new Map<string, PackageRow>();
  for (const row of [...((ownPackages ?? []) as PackageRow[]), ...kidPackages]) {
    packages.set(row.id, row);
  }
  const packageRows = [...packages.values()];

  const membershipRows = (memberships ?? []) as MembershipRow[];
  const customerIds = [
    ...new Set(
      membershipRows
        .map((row) => row.stripe_customer_id?.trim() ?? "")
        .filter(Boolean)
    ),
  ];
  const subscriptionIds = membershipRows
    .map((row) => row.stripe_subscription_id?.trim() ?? "")
    .filter(Boolean);

  let cancelledSubscriptionIds: string[] = [];
  try {
    cancelledSubscriptionIds = await cancelStripeSubscriptions(customerIds, subscriptionIds);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not cancel the Stripe subscription.",
    };
  }

  const { error: archiveError } = await admin.from("account_deletion_archives").insert({
    stripe_customer_ids: customerIds,
    stripe_subscription_ids: cancelledSubscriptionIds,
    membership_snapshot: membershipRows.map((row) => withoutUser(row)),
    package_ids: packageRows.map((row) => row.id),
    package_snapshot: packageRows.map((row) => withoutUser(row)),
  });
  if (archiveError) return { error: archiveError.message };

  if (packageRows.length > 0) {
    const { error: unlinkError } = await admin
      .from("student_packages")
      .update({ user_id: null, kid_profile_id: null })
      .in(
        "id",
        packageRows.map((row) => row.id)
      );
    if (unlinkError) return { error: unlinkError.message };
  }

  const extraFiles: Array<{ bucket: string; path: string }> = [];
  const { data: homework } = await admin
    .from("homework_submissions")
    .select("storage_path")
    .eq("student_id", user.id);
  for (const row of homework ?? []) {
    if (row.storage_path) extraFiles.push({ bucket: "homework-recordings", path: row.storage_path });
  }
  const { data: discounts } = await admin
    .from("student_discount_requests")
    .select("storage_path")
    .eq("user_id", user.id);
  for (const row of discounts ?? []) {
    if (row.storage_path) {
      extraFiles.push({ bucket: "student-discount-evidence", path: row.storage_path });
    }
  }

  await removeStorageObjects(admin, user.id, extraFiles);

  await admin.from("forum_reports").update({ reporter_id: null }).eq("reporter_id", user.id);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return { error: deleteError.message };

  const name = profile?.preferred_name?.trim() || profile?.full_name?.trim() || "";
  await sendAccountDeletionNotifyEmail({
    name,
    email: user.email ?? "",
    stripeCustomerIds: customerIds,
    stripeSubscriptionIds: cancelledSubscriptionIds,
    packageIds: packageRows.map((row) => row.id),
  });

  await supabase.auth.signOut();
  return { deleted: true };
}

async function staffBlockReason(
  admin: ReturnType<typeof createServiceRoleClient>,
  user: User
): Promise<string | null> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    admin.from("profiles").select("app_role").eq("id", user.id).maybeSingle(),
    admin.from("profile_roles").select("role").eq("user_id", user.id),
  ]);
  return accountDeletionBlockedReason(
    [profile?.app_role, ...(roles ?? []).map((row) => row.role as string)],
    isAdmin(user)
  );
}
