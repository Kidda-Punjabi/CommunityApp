"use client";

import { useActionState, useState } from "react";
import {
  requestCohortSwitch,
  type CalendarActionResult,
} from "@/app/dashboard/tutor/calendar-actions";
import {
  COHORT_SWITCH_SHORT_NOTICE_WARNING,
  COHORT_SWITCH_WARNING,
} from "@/lib/calendar/cohort-switch-policy";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};

export function CohortSwitchRequestForm({
  session,
  onDone,
}: {
  session: StudentScheduledSession;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(requestCohortSwitch, initial);
  const [open, setOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [shortNoticeAcknowledged, setShortNoticeAcknowledged] = useState(false);

  if (state.success) {
    return <p className="mt-3 text-sm text-emerald-700">{state.success}</p>;
  }

  const requiresShortNoticeAck = session.isShortNoticeCohortSwitch;
  const canSubmit =
    Boolean(selectedSessionId) && (!requiresShortNoticeAck || shortNoticeAcknowledged);

  if (!open) {
    return (
      <div className="mt-3">
        <button type="button" onClick={() => setOpen(true)} className={ui.btnPrimary}>
          Request to reschedule
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
      <input type="hidden" name="session_id" value={session.id} />
      <input type="hidden" name="to_session_id" value={selectedSessionId} />
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Which matching session would you like to join instead?
        </label>
        {session.alternateCohorts.length === 0 ? (
          <p className="mt-1.5 text-sm text-zinc-500">
            No matching alternate session available for this week.
          </p>
        ) : (
          <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
            {session.alternateCohorts.map((cohort) => {
              const selected = selectedSessionId === cohort.id;
              return (
                <button
                  key={cohort.id}
                  type="button"
                  onClick={() => setSelectedSessionId(cohort.id)}
                  className={
                    selected
                      ? "rounded-2xl border-2 border-violet-500 bg-violet-50 px-4 py-3 text-left"
                      : "rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-violet-300"
                  }
                  aria-pressed={selected}
                >
                  <p className="font-semibold text-zinc-900">{cohort.name}</p>
                  <p className="mt-1 text-sm text-zinc-600">{cohort.tutorName}</p>
                  <p className="mt-2 text-sm font-medium text-violet-700">
                    {new Date(cohort.startsAt).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    ·{" "}
                    {new Date(cohort.startsAt).toLocaleTimeString("en-GB", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {new Date(cohort.endsAt).toLocaleTimeString("en-GB", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Why do you need a different group?
        </label>
        <textarea
          name="message"
          required
          rows={3}
          className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Brief explanation for your tutor"
        />
      </div>
      <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{COHORT_SWITCH_WARNING}</p>
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
      ) : (
        <p className="text-xs text-zinc-500">
          Beginners group students get up to 2 alternate cohort requests for the course — please
          only request a different class if it is genuinely necessary.
        </p>
      )}
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending || !canSubmit} className={ui.btnPrimary}>
          {pending ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelectedSessionId("");
            setShortNoticeAcknowledged(false);
            onDone?.();
          }}
          className={ui.btnGhost}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
