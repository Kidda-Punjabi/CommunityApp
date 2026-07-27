"use client";

import { useActionState } from "react";
import {
  declineAssignedCover,
  requestSessionCover,
  type CoverActionResult,
  type TutorCoverInboxItem,
} from "@/app/dashboard/tutor/cover-actions";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import { ui } from "@/lib/ui/styles";

const initial: CoverActionResult = {};

export function TutorCoverRequestForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(requestSessionCover, initial);

  if (state.success) {
    return <p className="mt-2 text-sm text-emerald-700">{state.success}</p>;
  }

  return (
    <form action={action} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <label className="block text-sm text-zinc-700">
        Why do you need cover? (optional)
        <input
          name="reason"
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder="e.g. Medical appointment"
        />
      </label>
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={ui.btnGhost}>
        {pending ? "Requesting…" : "Request cover"}
      </button>
      <p className="text-xs text-zinc-500">
        An available tutor is assigned automatically. They have 48 hours to decline; no response
        means confirmed.
      </p>
    </form>
  );
}

export function TutorCoverInbox({ items }: { items: TutorCoverInboxItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8 space-y-3">
      <h2 className={ui.sectionTitle}>Cover requests</h2>
      {items.map((item) => (
        <CoverInboxCard key={item.id} item={item} />
      ))}
    </section>
  );
}

function CoverInboxCard({ item }: { item: TutorCoverInboxItem }) {
  const [state, action, pending] = useActionState(declineAssignedCover, initial);
  const canDecline =
    item.role === "assigned" &&
    item.status === "assigned" &&
    item.decisionDeadline &&
    new Date(item.decisionDeadline).getTime() > Date.now();

  return (
    <div className={`${ui.cardBordered} space-y-2`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
        {item.role === "assigned" ? "Assigned to you" : "Your cover request"} · {item.status}
      </p>
      <p className="font-semibold text-zinc-900">{item.sessionTitle}</p>
      {item.sessionStartsAt && item.sessionEndsAt ? (
        <p className="text-sm text-zinc-500">
          {formatSessionWhen(item.sessionStartsAt, item.sessionEndsAt)}
        </p>
      ) : null}
      <p className="text-sm text-zinc-600">
        Requested by {item.requestingTutorName}
        {item.assignedTutorName ? ` · Assigned to ${item.assignedTutorName}` : ""}
      </p>
      {item.decisionDeadline && item.status === "assigned" ? (
        <p className="text-xs text-amber-700">
          Decline by {new Date(item.decisionDeadline).toLocaleString("en-GB")} or it confirms
          automatically.
        </p>
      ) : null}
      {item.status === "needs_admin" ? (
        <p className="text-sm text-rose-700">
          No available tutor found — needs admin follow-up.
        </p>
      ) : null}

      {canDecline ? (
        <form action={action} className="space-y-2 border-t border-zinc-100 pt-3">
          <input type="hidden" name="cover_request_id" value={item.id} />
          <input
            name="decline_reason"
            placeholder="Reason (optional)"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
          {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
          <button type="submit" disabled={pending} className={ui.btnSecondary}>
            {pending ? "Declining…" : "Decline cover"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
