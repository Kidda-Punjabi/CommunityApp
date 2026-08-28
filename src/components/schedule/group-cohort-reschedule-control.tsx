"use client";

import { CancelCohortSwitchRequestControl } from "@/components/schedule/cancel-cohort-switch-request-control";
import { CohortSwitchRequestForm } from "@/components/schedule/cohort-switch-request-form";
import { SessionSwitchEmptyState } from "@/components/schedule/session-switch-empty-state";
import { NO_MATCHING_ALTERNATE_SESSION_COPY } from "@/lib/calendar/constants";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import { cn, ui } from "@/lib/ui/styles";

export const NO_ALTERNATIVE_SESSIONS_COPY = NO_MATCHING_ALTERNATE_SESSION_COPY;

type GroupCohortRescheduleControlProps = {
  session?: StudentScheduledSession | null;
  /** When the student is in a group cohort but no upcoming session is attached. */
  forceShow?: boolean;
  /** Pending requests are often already shown in the lesson schedule block. */
  showPending?: boolean;
  className?: string;
};

export function GroupCohortRescheduleControl({
  session = null,
  forceShow = false,
  showPending = true,
  className,
}: GroupCohortRescheduleControlProps) {
  const isGroup = Boolean(session?.cohort_id) || forceShow;
  if (!isGroup) return null;

  const request = session?.cohortSwitchRequest ?? null;
  const pending = request?.status === "pending";
  const approved = request?.status === "approved";
  const calendarSynced = Boolean(request?.calendar_synced_at);

  if (pending && request) {
    if (!showPending) return null;
    return (
      <CancelCohortSwitchRequestControl
        request={request}
        className={className ?? "mt-3"}
        compact
      />
    );
  }

  if (approved && request) {
    if (calendarSynced) {
      return (
        <p className={cn("rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800", className)}>
          Session switch confirmed
          {request.toCohortName ? ` — you're in ${request.toCohortName} for this class.` : "."}{" "}
          Check your calendar invite.
        </p>
      );
    }
    if (request.sync_error) {
      return (
        <p className={cn("rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900", className)}>
          Your session switch was approved, but the calendar invite still needs updating. Kidda
          will retry this — your usual class stays yours until the invite changes.
        </p>
      );
    }
    return (
      <p className={cn("rounded-2xl bg-violet-50 px-3 py-2 text-sm text-violet-900", className)}>
        Request approved — updating your calendar invite. Your usual class stays yours until that
        finishes.
      </p>
    );
  }

  if (session?.canRequestCohortSwitch) {
    return (
      <div className={className}>
        <p className="text-xs text-zinc-500">
          Can&apos;t make this class? Switch into another cohort&apos;s session for this week only.
        </p>
        <CohortSwitchRequestForm session={session} />
      </div>
    );
  }

  if (session?.noEquivalentSession) {
    return <SessionSwitchEmptyState session={session} className={className} />;
  }

  const reason = session?.cohortSwitchLockedReason ?? NO_ALTERNATIVE_SESSIONS_COPY;

  return (
    <div className={className}>
      <button
        type="button"
        disabled
        className={cn(ui.btnGhost, "cursor-not-allowed border border-zinc-200 opacity-60 hover:bg-white")}
      >
        Switch this session
      </button>
      <p className="mt-2 text-xs text-zinc-500">{reason}</p>
    </div>
  );
}
