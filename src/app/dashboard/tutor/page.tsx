import Link from "next/link";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";
import { loadPendingHomeworkReviews } from "@/lib/tutoring/homework-submissions";
import { getDisplayName } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

type TutorHomePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function TutorHomePage({ searchParams }: TutorHomePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [params, data, pendingHomework, profile] = await Promise.all([
    searchParams,
    loadTutorDashboard(supabase, user!.id),
    loadPendingHomeworkReviews(supabase),
    loadEditableProfile(supabase, user!.id),
  ]);

  const displayName = getDisplayName(profile);
  const studentCount =
    data.foundationalStudents.length + data.beginnersOneToOne.length;
  const cohortCount = data.beginnersGroups.length;
  const homeworkCount = pendingHomework.length;

  const accessError =
    params.error === "cohort-access"
      ? "That cohort could not be opened. Check your assignment in admin."
      : null;

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title={displayName ? `Hi, ${displayName}` : "Tutor home"}
        subtitle="Your teaching hub — pick a task below or use the bar at the bottom."
      />

      {accessError && (
        <p className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {accessError}
        </p>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3">
        <StatCard label="1-1 students" value={studentCount} />
        <StatCard label="Group cohorts" value={cohortCount} />
        <StatCard
          label="Homework to review"
          value={homeworkCount}
          highlight={homeworkCount > 0}
        />
        <StatCard
          label="Group students"
          value={data.beginnersGroups.reduce((sum, c) => sum + c.memberCount, 0)}
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Quick tasks
      </h2>
      <ul className="space-y-3">
        <QuickTaskLink
          href="/dashboard/tutor/homework"
          title="Review homework"
          description={
            homeworkCount > 0
              ? `${homeworkCount} submission${homeworkCount === 1 ? "" : "s"} waiting`
              : "No pending voice homework"
          }
          badge={homeworkCount > 0 ? String(homeworkCount) : undefined}
        />
        {cohortCount > 0 && (
          <QuickTaskLink
            href="/dashboard/tutor/attendance"
            title="Mark attendance"
            description="Record who attended a group live session"
          />
        )}
        <QuickTaskLink
          href="/dashboard/tutor/calendar"
          title="Calendar & lessons"
          description="Connect Google Calendar and manage upcoming live sessions"
        />
        <QuickTaskLink
          href="/dashboard/tutor/lessons"
          title="Manage lessons"
          description="Unlock lessons and add session recordings"
        />
      </ul>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.07)] ${
        highlight ? "bg-violet-100 ring-1 ring-violet-200" : "bg-white"
      }`}
    >
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function QuickTaskLink({
  href,
  title,
  description,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <li>
      <Link href={href} className={`${ui.cardInteractive} flex items-center gap-4`}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900">{title}</p>
          <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
        </div>
        {badge && (
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-violet-600 px-2 text-xs font-bold text-white">
            {badge}
          </span>
        )}
        <span className="text-violet-600" aria-hidden="true">
          →
        </span>
      </Link>
    </li>
  );
}
