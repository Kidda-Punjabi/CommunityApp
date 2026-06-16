import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/app/dashboard/logout-button";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, membership_tier, avatar_url")
    .eq("id", user!.id)
    .single();

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || "Member";

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
          <p className="mt-1 text-lg font-semibold capitalize text-violet-600">
            {profile?.membership_tier ?? "free"}
          </p>
        </div>

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
