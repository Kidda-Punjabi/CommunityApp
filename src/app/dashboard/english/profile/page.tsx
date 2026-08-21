import { UserAvatar } from "@/components/profile/user-avatar";
import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { getDisplayName } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { loadEnglishProgression } from "@/lib/progression/load-english-progression";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function EnglishProfilePage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  const privateCourses = await fetchAccessiblePrivateCourses(supabase, user.id);

  if (privateCourses.length === 0) {
    redirect("/dashboard/profile");
  }

  const [profile, progression] = await Promise.all([
    loadEditableProfile(supabase, user.id),
    loadEnglishProgression(supabase, user.id),
  ]);
  const displayName = getDisplayName(profile);

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
            size="lg"
            className="shrink-0 shadow-[0_4px_20px_-4px_rgba(5,150,105,0.12)] ring-4 ring-emerald-50"
          />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-medium text-zinc-900">
              {displayName || "Your profile"}
            </h1>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{user.email}</p>
            <p className="mt-1 text-sm tabular-nums text-zinc-500">
              {progression.totalXp.toLocaleString()} English XP
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/profile/edit"
          className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
        >
          Edit
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-6 py-5">
          <p className="text-xs font-medium text-emerald-700">English learning</p>
          <p className="mt-2 text-sm text-zinc-700">
            Progress and XP here are separate from Punjabi learning.
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            Course: {privateCourses[0]?.name}
          </p>
        </div>

        <div className="rounded-xl border border-violet-200 bg-white px-6 py-5">
          <p className="text-xs font-medium text-violet-600">Switch to Punjabi</p>
          <p className="mt-2 text-sm text-zinc-600">
            Return to the main Punjabi app with lessons, games, and community.
          </p>
          <Link
            href="/dashboard/learn"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Go to Punjabi app
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white px-6 py-5">
          <p className="text-xs font-medium text-emerald-700">Progress</p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-zinc-900">
                {progression.lessonsCompleted}
                {progression.lessonsTotal > 0 ? (
                  <span className="text-base font-medium text-zinc-400">
                    /{progression.lessonsTotal}
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-zinc-500">Lessons complete</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900">
                {progression.totalXp.toLocaleString()}
              </p>
              <p className="text-xs text-zinc-500">English XP</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-5">
          <p className="text-xs font-medium text-zinc-500">Account</p>
          <div className="mt-4 space-y-3">
            <Link
              href="/dashboard/profile/edit"
              className="block text-sm font-medium text-emerald-700 hover:text-emerald-600"
            >
              Edit profile →
            </Link>
            <Link
              href="/dashboard/membership"
              className="block text-sm font-medium text-emerald-700 hover:text-emerald-600"
            >
              Manage membership →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
