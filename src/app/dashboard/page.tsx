import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, membership_tier, avatar_url")
    .eq("id", user.id)
    .single();

  const displayName =
    profile?.full_name || user.user_metadata?.full_name || user.email;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold uppercase tracking-widest text-violet-600">
            Kidda
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Welcome{displayName ? `, ${displayName}` : ""}
        </h1>
        <p className="mt-2 text-zinc-500">
          You&apos;re signed in to your Kidda dashboard.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-500">Email</h2>
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              {user.email}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-500">
              Membership tier
            </h2>
            <p className="mt-1 text-lg font-semibold capitalize text-zinc-900">
              {profile?.membership_tier ?? "free"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
