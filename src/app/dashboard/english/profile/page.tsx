import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { getDisplayName } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { loadUserProgression } from "@/lib/progression/load-user-progression";
import { UserAvatar } from "@/components/profile/user-avatar";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function EnglishProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const privateCourses = await fetchAccessiblePrivateCourses(supabase, user.id);

  if (privateCourses.length === 0) {
    redirect("/dashboard/learn");
  }

  const profile = await loadEditableProfile(supabase, user.id);
  const displayName = getDisplayName(profile);
  const progression = await loadUserProgression(supabase, user.id);

  return (
    <div className={ui.page}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar
            profile={{
              full_name: profile?.full_name,
              preferred_name: profile?.preferred_name,
              avatar_url: profile?.avatar_url,
            }}
            level={progression.learnerLevel}
            size="lg"
            className="shrink-0 shadow-[0_4px_20px_-4px_rgba(5,150,105,0.12)] ring-4 ring-emerald-50"
          />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-medium text-zinc-900">
              {displayName || "Your profile"}
            </h1>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{user.email}</p>
            <p className="mt-1 text-sm tabular-nums text-zinc-500">
              {progression.totalXp.toLocaleString()} lifetime XP
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/profile/edit"
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Edit
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-6 py-5">
          <p className="text-xs font-medium text-emerald-700">English Learning</p>
          <p className="mt-2 text-sm text-zinc-700">
            You're currently in the English learning section.
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            Course: {privateCourses[0]?.name}
          </p>
        </div>

        <div className="rounded-xl border border-violet-200 bg-white px-6 py-5">
          <p className="text-xs font-medium text-violet-600">Switch to Punjabi</p>
          <p className="mt-2 text-sm text-zinc-600">
            Return to the main Punjabi learning app with lessons, games, and community.
          </p>
          <Link
            href="/dashboard/home"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Go to Punjabi app
          </Link>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-5">
          <p className="text-xs font-medium text-zinc-500">Progress</p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-zinc-900">{progression.learnerLevel}</p>
              <p className="text-xs text-zinc-500">Level</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">
                {progression.totalXp.toLocaleString()}
              </p>
              <p className="text-xs text-zinc-500">Total XP</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-5">
          <p className="text-xs font-medium text-zinc-500">Account Settings</p>
          <div className="mt-4 space-y-3">
            <Link
              href="/dashboard/profile/edit"
              className="block text-sm font-medium text-violet-600 hover:text-violet-500"
            >
              Edit profile →
            </Link>
            <Link
              href="/dashboard/membership"
              className="block text-sm font-medium text-violet-600 hover:text-violet-500"
            >
              Manage membership →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
