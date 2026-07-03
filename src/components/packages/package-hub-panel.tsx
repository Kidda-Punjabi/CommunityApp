import Link from "next/link";
import { BuyButton } from "@/components/products/buy-button";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ONE_TO_ONE_SESSION_CHECKOUT_KEY, isCheckoutConfigured } from "@/lib/products/checkout";
import type { StudentPackage } from "@/lib/packages/load-student-packages";
import { ui } from "@/lib/ui/styles";

type PackageHubPanelProps = {
  pkg: StudentPackage;
  variant?: "full" | "embedded";
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
  const configured = isCheckoutConfigured(ONE_TO_ONE_SESSION_CHECKOUT_KEY);

  if (!shouldShowBuyExtraOneToOneLesson(pkg)) return null;

  return (
    <div className={`${ui.cardBordered} space-y-3`}>
      <p className="text-sm font-semibold text-violet-900">Need an extra 1-to-1 lesson?</p>
      <p className="text-sm text-violet-800">
        Buy an additional session with your tutor and then choose your time on the schedule page.
      </p>
      <div className="max-w-xs">
        <BuyButton
          checkoutKey={ONE_TO_ONE_SESSION_CHECKOUT_KEY}
          label="Buy extra 1-to-1 lesson"
          configured={configured}
          className={ui.btnPrimary}
        />
      </div>
    </div>
  );
}

export function PackageHubPanel({ pkg, variant = "full" }: PackageHubPanelProps) {
  const body = (
    <>
      {variant === "full" ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              Your package
            </p>
            <p className="mt-1 text-sm text-zinc-500">{pkg.description}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(pkg.status)}`}
          >
            {statusLabel(pkg.status)}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your package
          </p>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(pkg.status)}`}
          >
            {statusLabel(pkg.status)}
          </span>
        </div>
      )}

      {pkg.includesLiveSessions ? (
        <div className="rounded-2xl bg-zinc-50 px-4 py-3">
          {pkg.tutorName ? (
            <div className="flex items-center gap-3">
              <UserAvatar
                profile={{
                  full_name: pkg.tutorName,
                  preferred_name: null,
                  avatar_url: pkg.tutorAvatarUrl,
                }}
                size="sm"
              />
              <div>
                <p className="text-sm font-semibold text-zinc-900">{pkg.tutorName}</p>
                <p className="text-sm text-zinc-500">
                  {pkg.deliveryMode === "group" && pkg.cohortName
                    ? `Group · ${pkg.cohortName}`
                    : "1-1 tutoring"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">
              Your tutor and calendar invite are being set up. You can browse lessons meanwhile —
              content unlocks once your tutor is assigned.
            </p>
          )}
        </div>
      ) : null}

      {pkg.includesLiveSessions ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Live lessons
          </p>
          {pkg.nextSession ? (
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-zinc-900">{pkg.nextSession.title}</p>
                <p className="mt-0.5 text-sm text-zinc-500">{pkg.nextSession.whenLabel}</p>
                {pkg.upcomingSessionCount > 1 ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    +{pkg.upcomingSessionCount - 1} more upcoming
                  </p>
                ) : null}
              </div>
              {pkg.nextSession.meetLink ? (
                <a
                  href={pkg.nextSession.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ui.btnPrimary}
                >
                  Join
                </a>
              ) : null}
            </div>
          ) : pkg.status === "active" ? (
            <p className="text-sm text-zinc-500">
              No upcoming live lessons synced yet. Your tutor will add you to the Google Calendar
              invite for this package.
            </p>
          ) : null}

          <Link
            href="/dashboard/schedule"
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            View full schedule →
          </Link>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Community content and events — no personal tutor calendar for this package.
        </p>
      )}
    </>
  );

  if (variant === "embedded") {
    return <div className="space-y-4 border-t border-zinc-100 pt-4">{body}</div>;
  }

  return <div className={`${ui.cardBordered} mb-6 space-y-4`}>{body}</div>;
}
