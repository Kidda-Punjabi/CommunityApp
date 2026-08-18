"use client";

import { CancelCohortSwitchRequestControl } from "@/components/schedule/cancel-cohort-switch-request-control";
import { CohortSwitchRequestForm } from "@/components/schedule/cohort-switch-request-form";
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

  const pending = session?.cohortSwitchRequest?.status === "pending";
  const approved = session?.cohortSwitchRequest?.status === "approved";

  if (pending && session?.cohortSwitchRequest) {
    if (!showPending) return null;
    return (
      <CancelCohortSwitchRequestControl
        request={session.cohortSwitchRequest}
        className={className ?? "mt-3"}
        compact
      />
    );
  }

  if (approved) return null;

  if (session?.canRequestCohortSwitch) {
    return (
      <div className={className}>
        <p className="text-xs text-zinc-500">
          Can&apos;t make this group? Request a matching alternate session here.
        </p>
        <CohortSwitchRequestForm session={session} />
      </div>
    );
  }

  const reason =
    session?.cohortSwitchLockedReason ?? NO_ALTERNATIVE_SESSIONS_COPY;

  return (
    <div className={className}>
      <button
        type="button"
        disabled
        className={cn(ui.btnGhost, "cursor-not-allowed border border-zinc-200 opacity-60 hover:bg-white")}
      >
        Request to reschedule
      </button>
      <p className="mt-2 text-xs text-zinc-500">{reason}</p>
    </div>
  );
}
