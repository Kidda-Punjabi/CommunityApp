"use client";

import { useActionState, useState } from "react";
import {
  requestCohortSwitch,
  type CalendarActionResult,
} from "@/app/dashboard/tutor/calendar-actions";
import { CancelCohortSwitchRequestControl } from "@/components/schedule/cancel-cohort-switch-request-control";
import { SWITCH_COHORT_FEE_FOOTER } from "@/lib/calendar/cohort-week-progress";
import { COHORT_SWITCH_SHORT_NOTICE_WARNING } from "@/lib/calendar/cohort-switch-policy";
import type { SwitchCohortAlternateCard } from "@/lib/calendar/load-switch-cohort-page";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};

type SwitchCohortRequestSectionProps = {
  sourceSession: StudentScheduledSession | null;
  alternates: SwitchCohortAlternateCard[];
  canRequest: boolean;
  lockedReason: string | null;
  isShortNotice: boolean;
};

export function SwitchCohortRequestSection({
  sourceSession,
  alternates,
  canRequest,
  lockedReason,
  isShortNotice,
}: SwitchCohortRequestSectionProps) {
  const [state, action, pending] = useActionState(requestCohortSwitch, initial);
  const [shortNoticeAcknowledged, setShortNoticeAcknowledged] = useState(false);

  if (state.success) {
    return <p className="text-sm font-medium text-emerald-700">{state.success}</p>;
  }

  if (sourceSession?.cohortSwitchRequest?.status === "pending") {
    return <CancelCohortSwitchRequestControl request={sourceSession.cohortSwitchRequest} />;
  }

  if (sourceSession?.cohortSwitchRequest?.status === "approved") {
    return (
      <p className="text-sm text-zinc-600">
        Your cohort switch request was approved — check your schedule for details.
      </p>
    );
  }

  if (alternates.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {lockedReason ?? "No matching cohorts are available to switch to right now."}
      </p>
    );
  }

  const requiresShortNoticeAck = isShortNotice;
  const allowSubmit = canRequest && (!requiresShortNoticeAck || shortNoticeAcknowledged);

  return (
    <div className="space-y-4">
      {requiresShortNoticeAck ? (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-xs font-medium text-amber-950">{COHORT_SWITCH_SHORT_NOTICE_WARNING}</p>
          <label className="flex items-start gap-2 text-xs text-amber-950">
            <input
              type="checkbox"
              checked={shortNoticeAcknowledged}
              onChange={(event) => setShortNoticeAcknowledged(event.target.checked)}
              className="mt-0.5"
            />
            <span>I understand this is short notice and want to send the request anyway.</span>
          </label>
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}

      {alternates.map((option) => (
        <form key={option.sessionId} action={action} className={`${ui.cardBordered} space-y-3`}>
          <input type="hidden" name="session_id" value={sourceSession?.id ?? ""} />
          <input type="hidden" name="to_session_id" value={option.sessionId} />
          <input type="hidden" name="copy_variant" value="switch_cohort" />
          <input type="hidden" name="message" value="I'd like to switch to this cohort." />
          <div>
            <p className="font-semibold text-zinc-900">{option.name}</p>
            <p className="mt-0.5 text-sm text-zinc-600">{option.tutorName}</p>
            <p className="mt-2 text-sm font-medium text-violet-700">{option.dayTimeLabel}</p>
            {option.statusLabel ? (
              <p className="mt-1 text-sm text-zinc-500">{option.statusLabel}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={pending || !allowSubmit || !sourceSession}
            className={ui.btnPrimaryBlock}
          >
            {pending ? "Sending…" : "Request this cohort"}
          </button>
        </form>
      ))}

      {!canRequest && lockedReason ? (
        <p className="text-sm text-zinc-500">{lockedReason}</p>
      ) : null}

      <p className="text-center text-xs text-zinc-500">{SWITCH_COHORT_FEE_FOOTER}</p>
    </div>
  );
}
