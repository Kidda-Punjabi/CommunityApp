import Link from "next/link";
import { UserAvatar } from "@/components/profile/user-avatar";
import { CourseCohortStats } from "@/components/learn/course-cohort-stats";
import { GroupCohortRescheduleControl } from "@/components/schedule/group-cohort-reschedule-control";
import type { StudentPackage } from "@/lib/packages/load-student-packages";
import type { StudentCohortCourseStats } from "@/lib/lessons/load-student-cohort-course-stats";
import { ui } from "@/lib/ui/styles";

type PackageHubPanelProps = {
  pkg: StudentPackage;
  variant?: "full" | "embedded";
  cohortStats?: StudentCohortCourseStats | null;
};

function statusLabel(status: StudentPackage["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "pending_setup":
      return "Setting up";
    case "content_only":
      return "Content access";
  }
}

function statusClass(status: StudentPackage["status"]): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800";
    case "pending_setup":
      return "bg-amber-100 text-amber-900";
    case "content_only":
      return "bg-violet-100 text-violet-800";
  }
}

export function shouldShowBuyExtraOneToOneLesson(pkg: StudentPackage): boolean {
  return pkg.status === "active" && Boolean(pkg.tutorName);
}

export function BuyExtraOneToOneCard({ pkg }: { pkg: StudentPackage }) {
  if (!shouldShowBuyExtraOneToOneLesson(pkg)) return null;

  return (
    <div className={`${ui.cardBordered} space-y-3`}>
      <p className="text-sm font-semibold text-violet-900">Need an extra 1-to-1 lesson?</p>
      <p className="text-sm text-violet-800">
        Choose a time on the schedule page, then pay to confirm a session for {pkg.name}.
      </p>
      <div className="max-w-xs">
        <Link href="/dashboard/schedule" className={ui.btnPrimary}>
          Book on Schedule →
        </Link>
      </div>
    </div>
  );
}

export function PackageHubPanel({
  pkg,
  variant = "full",
  cohortStats = null,
}: PackageHubPanelProps) {
  const contactName = pkg.tutorName ?? pkg.communityLeadName;
  const contactAvatar = pkg.tutorAvatarUrl ?? pkg.communityLeadAvatarUrl;
  const contactLabel = pkg.tutorName
    ? pkg.deliveryMode === "group" && pkg.cohortName
      ? `Group · ${pkg.cohortName}`
      : "1-1 tutoring"
    : pkg.communityLeadName
      ? "Community lead"
      : null;

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your package
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900">{pkg.name}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(pkg.status)}`}
        >
          {statusLabel(pkg.status)}
        </span>
      </div>

      {contactName ? (
        <div className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
          <UserAvatar
            profile={{
              full_name: contactName,
              preferred_name: null,
              avatar_url: contactAvatar,
            }}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">{contactName}</p>
            {contactLabel ? (
              <p className="truncate text-xs text-zinc-500">{contactLabel}</p>
            ) : null}
          </div>
          {cohortStats ? <CourseCohortStats stats={cohortStats} /> : null}
        </div>
      ) : pkg.includesLiveSessions ? (
        <p className="text-xs text-zinc-500">
          Your tutor is being assigned — you can browse lessons meanwhile.
        </p>
      ) : null}

      {pkg.deliveryMode === "group" ? (
        <GroupCohortRescheduleControl
          session={pkg.groupRescheduleSession}
          forceShow
          className="pt-1"
        />
      ) : null}

    </>
  );

  if (variant === "embedded") {
    return <div className="space-y-3 border-t border-zinc-100 pt-3">{body}</div>;
  }

  return <div className={`${ui.cardBordered} mb-6 space-y-3`}>{body}</div>;
}
