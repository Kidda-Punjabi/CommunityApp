import { LogoutButton } from "@/app/dashboard/logout-button";
import { ViewAsPanel } from "@/app/dashboard/profile/view-as-panel";
import { isAdmin } from "@/lib/auth/admin";
import {
  formatUnlockedCourseNames,
  getCourseAccessContext,
  tiersFromUnlockedCourses,
} from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";
import { syncStripePurchasesForUser } from "@/lib/stripe/sync-purchases";
import Link from "next/link";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user!.id)
    .single();

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || "Member";

  if (user?.email) {
    try {
      await syncStripePurchasesForUser(user.id, user.email);
    } catch {
      // Best-effort Stripe sync.
    }
  }

  const access = await getCourseAccessContext(supabase, user!);

  const membershipLabel = access.viewAs?.active
    ? `Testing: ${access.viewAs.label}`
    : formatUnlockedCourseNames(access.courses, access.unlockedCourseIds);

  return (
    <div className="flex flex-1 flex-col px-6 py-8">
      <div className="text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 text-4xl ring-4 ring-white shadow-sm">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span role="img" aria-hidden="true">
              👤
            </span>
          )}
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-zinc-900">
          Profile
        </h1>
        <p className="mt-1 text-lg font-medium text-zinc-700">{displayName}</p>
        <p className="mt-1 text-sm text-zinc-500">{user?.email}</p>
      </div>

      <div className="mt-10 space-y-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Membership
          </p>
          <p className="mt-1 text-lg font-semibold text-violet-600">{membershipLabel}</p>
          <Link
            href="/dashboard/membership"
            className="mt-3 inline-block text-sm font-semibold text-violet-600 hover:text-violet-500"
          >
            {access.isFreeOnly ? "Browse courses →" : "Buy another course →"}
          </Link>
        </div>

        {isAdmin(user) && (
          <ViewAsPanel
            initialTiers={
              access.viewAs?.active
                ? access.viewAs.tiers
                : tiersFromUnlockedCourses(access.courses, access.unlockedCourseIds)
            }
            isOverrideActive={Boolean(access.viewAs?.active)}
          />
        )}

        {isAdmin(user) && (
          <div className="rounded-2xl bg-violet-50 p-5 shadow-sm ring-1 ring-violet-200/80">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              Admin
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Manage courses, lessons, quizzes, and teachers.
            </p>
            <Link
              href="/admin/content"
              className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
            >
              Open admin panel
            </Link>
          </div>
        )}

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Account
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Manage your settings and preferences here soon.
          </p>
        </div>
      </div>

      <div className="mt-auto pt-10">
        <LogoutButton />
      </div>
    </div>
  );
}
