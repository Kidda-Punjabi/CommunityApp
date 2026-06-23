import Link from "next/link";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { UserAvatar } from "@/components/profile/user-avatar";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";
import { getDisplayName } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function TutorProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profile, data] = await Promise.all([
    loadEditableProfile(supabase, user!.id),
    loadTutorDashboard(supabase, user!.id),
  ]);

  const displayName = getDisplayName(profile);
  const oneToOneCount =
    data.foundationalStudents.length + data.beginnersOneToOne.length;
  const groupStudentCount = data.beginnersGroups.reduce(
    (sum, cohort) => sum + cohort.memberCount,
    0
  );

  return (
    <div className={ui.page}>
      <TutorPageHeader title="Tutor profile" subtitle="Your teaching account at a glance." />

      <div className="text-center">
        <UserAvatar
          profile={{
            full_name: profile?.full_name,
            preferred_name: profile?.preferred_name,
            avatar_url: profile?.avatar_url,
          }}
          size="lg"
          className="mx-auto shadow-[0_4px_20px_-4px_rgba(24,24,27,0.12)] ring-4 ring-white"
        />
        {displayName && (
          <p className="mt-4 text-xl font-semibold text-zinc-900">{displayName}</p>
        )}
        <p className="mt-1 text-sm text-zinc-500">{user?.email}</p>
        <p className="mt-3 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700">
          Tutor
        </p>
      </div>

      <div className={`mt-8 ${ui.stack}`}>
        <div className={ui.card}>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your students
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            <li>
              <span className="font-semibold text-zinc-900">{oneToOneCount}</span>{" "}
              1-1 student{oneToOneCount === 1 ? "" : "s"}
            </li>
            <li>
              <span className="font-semibold text-zinc-900">
                {data.beginnersGroups.length}
              </span>{" "}
              group cohort{data.beginnersGroups.length === 1 ? "" : "s"} (
              {groupStudentCount} student{groupStudentCount === 1 ? "" : "s"})
            </li>
          </ul>
        </div>

        <Link href="/dashboard/profile" className={ui.cardInteractive}>
          <p className="font-semibold text-zinc-900">Learner profile</p>
          <p className="mt-1 text-sm text-zinc-500">
            Switch to your student account settings, friends, and membership.
          </p>
          <p className="mt-2 text-sm font-semibold text-violet-600">Open learner profile →</p>
        </Link>

        <Link
          href="/dashboard/profile/notifications"
          className="block text-center text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          Notification settings
        </Link>
      </div>
    </div>
  );
}
