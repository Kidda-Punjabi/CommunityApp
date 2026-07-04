import Link from "next/link";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import { loadTutorPendingRequestCounts } from "@/lib/calendar/load-sessions";
import {
  buildTutorAssignmentRows,
  loadTutorDashboard,
  loadTutorTodayLessons,
  type TutorAssignedPackageRow,
  type TutorTodayLessonRow,
} from "@/lib/tutoring/load-tutor-dashboard";
import { loadPendingHomeworkReviews } from "@/lib/tutoring/homework-submissions";
import { getDisplayName, getGreetingHeading } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { TutorSetupChecklist } from "@/components/tutor/tutor-setup-checklist";
import { loadTutorSetupStatus } from "@/lib/tutoring/tutor-setup-status";
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

  const [params, data, pendingHomework, profile, pendingRequests, todayLessons, setupStatus] =
    await Promise.all([
      searchParams,
      loadTutorDashboard(supabase, user!.id),
      loadPendingHomeworkReviews(supabase),
      loadEditableProfile(supabase, user!.id),
      loadTutorPendingRequestCounts(supabase, user!.id),
      loadTutorTodayLessons(supabase, user!.id),
      loadTutorSetupStatus(supabase, user!.id),
    ]);

  const assignedPackages = buildTutorAssignmentRows(data);
  const displayName =
    getDisplayName(profile) ?? user?.email?.split("@")[0] ?? null;
  const studentCount =
    data.foundationalStudents.length + data.beginnersOneToOne.length;
  const cohortCount = data.beginnersGroups.length;
  const homeworkCount = pendingHomework.length;
  const requestCount = pendingRequests.total;

  const accessError =
    params.error === "cohort-access"
      ? "That cohort could not be opened. Check your assignment in admin."
      : null;

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title={getGreetingHeading(displayName)}
        subtitle="Your teaching hub — pick a task below or use the bar at the bottom."
      />

      {accessError && (
        <p className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {accessError}
        </p>
      )}

      {setupStatus.showPrompt ? (
        <div className="mb-8">
          <TutorSetupChecklist status={setupStatus} />
        </div>
      ) : null}

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

      {(requestCount > 0 || homeworkCount > 0 || cohortCount > 0 || todayLessons.length > 0) && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Quick tasks
          </h2>
          <ul className="space-y-3">
            {requestCount > 0 ? (
              <QuickTaskLink
                href="/dashboard/tutor/requests"
                title="Review student requests"
                description={`${requestCount} reschedule or cohort request${requestCount === 1 ? "" : "s"} waiting`}
                badge={String(requestCount)}
              />
            ) : null}
            {homeworkCount > 0 ? (
              <QuickTaskLink
                href="/dashboard/tutor/homework"
                title="Review homework"
                description={`${homeworkCount} submission${homeworkCount === 1 ? "" : "s"} waiting`}
                badge={String(homeworkCount)}
              />
            ) : null}
            {cohortCount > 0 ? (
              <QuickTaskLink
                href="/dashboard/tutor/attendance"
                title="Mark attendance"
                description="Record who attended a group live session"
              />
            ) : null}
            {todayLessons.length > 0 ? (
              <QuickTaskLink
                href="/dashboard/tutor/calendar"
                title="Today's lessons"
                description={`${todayLessons.length} lesson${todayLessons.length === 1 ? "" : "s"} on your calendar today`}
              />
            ) : null}
          </ul>
        </>
      )}

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Today&apos;s lessons
          </h2>
          <Link href="/dashboard/tutor/calendar" className="text-sm font-medium text-violet-600 hover:text-violet-500">
            Open calendar →
          </Link>
        </div>
        <TutorTodayLessonsList lessons={todayLessons} />
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            My assignments
          </h2>
          <Link href="/dashboard/tutor/lessons" className="text-sm font-medium text-violet-600 hover:text-violet-500">
            Manage lessons →
          </Link>
        </div>
        <TutorAssignedPackagesList packages={assignedPackages} />
      </section>
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

function TutorTodayLessonsList({ lessons }: { lessons: TutorTodayLessonRow[] }) {
  if (lessons.length === 0) {
    return (
      <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
        No lessons scheduled for today.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {lessons.map((lesson) => (
        <li key={lesson.id} className={`${ui.cardBordered} flex items-start justify-between gap-3`}>
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900">{lesson.title}</p>
            <p className="mt-1 text-sm text-zinc-600">
              {lesson.cohortName ? `Group · ${lesson.cohortName}` : `1-1 · ${lesson.studentName ?? "Student"}`}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{formatSessionWhen(lesson.startsAt, lesson.endsAt)}</p>
          </div>
          {lesson.meetLink ? (
            <a href={lesson.meetLink} target="_blank" rel="noopener noreferrer" className={ui.btnPrimary}>
              Join
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function TutorAssignedPackagesList({ packages }: { packages: TutorAssignedPackageRow[] }) {
  if (packages.length === 0) {
    return (
      <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
        No students or cohorts assigned to you yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {packages.map((pkg) => (
        <li key={`${pkg.kind}-${pkg.id}`}>
          <Link href={pkg.href} className={`${ui.cardInteractive} block`}>
            <p className="font-semibold text-zinc-900">{pkg.name}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {pkg.courseName} · {pkg.kind === "cohort" ? "Group cohort" : "1-1 package run"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {pkg.memberCount} student{pkg.memberCount === 1 ? "" : "s"}
              {pkg.capacity ? ` / ${pkg.capacity} capacity` : ""}
              {pkg.status ? ` · ${pkg.status.replace(/_/g, " ")}` : ""}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
