import { DeleteAccountForm } from "@/app/dashboard/profile/delete/delete-account-form";
import { accountDeletionBlockedReason } from "@/lib/account/deletion-policy";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DeleteAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("app_role").eq("id", user.id).maybeSingle(),
    supabase.from("profile_roles").select("role").eq("user_id", user.id),
  ]);

  const blockedReason = accountDeletionBlockedReason(
    [profile?.app_role, ...(roles ?? []).map((row) => row.role as string)],
    isAdmin(user)
  );

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/profile"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to profile
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">Delete account</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-600">
        <p>This permanently deletes your Kidda login and the personal data stored with it.</p>
        <p>
          That includes kid profiles, homework, forum posts, notifications, streaks, and files
          such as recordings and photos.
        </p>
        <p>
          Payment records the business has to keep are unlinked from you. They are no longer
          attached to this account. Active subscriptions are cancelled.
        </p>
      </div>
      <div className="mt-6">
        <DeleteAccountForm blockedReason={blockedReason} />
      </div>
    </div>
  );
}
