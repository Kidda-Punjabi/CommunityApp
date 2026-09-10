"use client";

import { useActionState, useEffect, useState } from "react";
import {
  resolveRescheduleRequest,
  type CalendarActionResult,
} from "@/app/dashboard/tutor/calendar-actions";
import { loadTutorRescheduleSlots } from "@/app/dashboard/tutor/reschedule-slot-actions";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};

export type TutorRescheduleRequestItem = {
  id: string;
  session_id: string;
  message: string;
  preferred_times: string | null;
  studentName: string;
  sessionTitle: string;
  sessionStartsAt: string | null;
  sessionEndsAt: string | null;
};

type TutorRequestsInboxProps = {
  rescheduleRequests: TutorRescheduleRequestItem[];
};

export function TutorRequestsInbox({ rescheduleRequests }: TutorRequestsInboxProps) {
  if (rescheduleRequests.length === 0) {
    return (
      <div className={ui.emptyState}>
        <p className="font-semibold text-zinc-900">No pending requests</p>
        <p className="mt-2 text-sm text-zinc-500">
          When students ask to reschedule a 1-to-1 lesson, their requests will appear here.
          Alternate cohort requests are reviewed by Kidda admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className={ui.sectionTitle}>
          Reschedule requests ({rescheduleRequests.length})
        </h2>
        {rescheduleRequests.map((request) => (
          <RescheduleRequestCard key={request.id} request={request} />
        ))}
      </section>
    </div>
  );
}

function RescheduleRequestCard({ request }: { request: TutorRescheduleRequestItem }) {
  const [state, action, pending] = useActionState(resolveRescheduleRequest, initial);
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selected, setSelected] = useState("");

  const isLateCancel = (request.preferred_times ?? "").startsWith("Late cancel");

  useEffect(() => {
    if (isLateCancel || !request.sessionStartsAt || !request.sessionEndsAt) return;
    setSlotsLoading(true);
    void loadTutorRescheduleSlots(request.sessionStartsAt, request.sessionEndsAt).then((result) => {
      setSlots(result.slots);
      setSlotsError(result.error ?? null);
      setSlotsLoading(false);
    });
  }, [isLateCancel, request.sessionStartsAt, request.sessionEndsAt]);

  const selectedSlot = slots.find((slot) => slot.startsAt === selected);
  const approveStartsAt = selectedSlot?.startsAt ?? "";
  const approveEndsAt = selectedSlot?.endsAt ?? "";

  return (
    <div className={`${ui.cardBordered} space-y-3`}>
      <RequestHeader
        studentName={request.studentName}
        sessionTitle={request.sessionTitle}
        sessionStartsAt={request.sessionStartsAt}
        sessionEndsAt={request.sessionEndsAt}
        badge="Reschedule"
      />
      <p className="text-sm text-zinc-700">{request.message}</p>
      {request.preferred_times ? (
        <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <span className="font-medium">Preferred times:</span> {request.preferred_times}
        </p>
      ) : null}

      <form action={action} className="space-y-3 border-t border-zinc-100 pt-3">
        <input type="hidden" name="request_id" value={request.id} />
        <input type="hidden" name="new_starts_at" value={approveStartsAt} />
        <input type="hidden" name="new_ends_at" value={approveEndsAt} />

        {isLateCancel ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Late cancel (within 24 hours). Confirming unlocks this lesson with Session catch-up
            instead of a recording.
          </p>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Available alternative times
            </label>
            {slotsLoading ? (
              <p className="text-sm text-zinc-500">Loading your free slots…</p>
            ) : slotsError ? (
              <p className="text-sm text-amber-700">{slotsError}</p>
            ) : (
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="">Select a time…</option>
                {slots.map((slot) => (
                  <option key={slot.startsAt} value={slot.startsAt}>
                    {slot.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <textarea
          name="tutor_response"
          rows={2}
          placeholder="Optional note to the student"
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
        />
        {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
        <p className="text-xs text-zinc-500">
          {isLateCancel
            ? "Confirming records the missed lesson and unlocks Session catch-up for the student."
            : "Approving updates the lesson time in the app and sends an updated Google Calendar invite."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="decision"
            value="denied"
            disabled={pending}
            className={isLateCancel ? ui.btnPrimary : ui.btnSecondary}
          >
            {isLateCancel ? "Confirm late cancel → unlock catch-up" : "Decline"}
          </button>
          {!isLateCancel ? (
            <button
              type="submit"
              name="decision"
              value="approved"
              disabled={pending || !approveStartsAt || !approveEndsAt}
              className={ui.btnPrimary}
            >
              Approve + update calendar
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function RequestHeader({
  studentName,
  sessionTitle,
  sessionStartsAt,
  sessionEndsAt,
  badge,
}: {
  studentName: string;
  sessionTitle: string;
  sessionStartsAt: string | null;
  sessionEndsAt: string | null;
  badge: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">{badge}</p>
      <p className="mt-1 font-semibold text-zinc-900">{studentName}</p>
      <p className="text-sm text-zinc-600">{sessionTitle}</p>
      {sessionStartsAt && sessionEndsAt ? (
        <p className="mt-1 text-sm text-zinc-500">
          Current: {formatSessionWhen(sessionStartsAt, sessionEndsAt)}
        </p>
      ) : null}
    </div>
  );
}
