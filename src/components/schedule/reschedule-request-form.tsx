"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { requestLessonReschedule, type CalendarActionResult } from "@/app/dashboard/tutor/calendar-actions";
import { fetchRescheduleSlotsForSession } from "@/app/dashboard/schedule/reschedule-actions";
import { BookingSlotCalendar } from "@/components/schedule/booking-slot-calendar";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};

export function RescheduleRequestForm({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(requestLessonReschedule, initial);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null);
  const [loadingSlots, startLoadSlots] = useTransition();

  useEffect(() => {
    if (!open) return;
    startLoadSlots(async () => {
      const result = await fetchRescheduleSlotsForSession(sessionId);
      setSlots(result.slots);
      setSlotsError(result.error ?? null);
      setSelectedSlot(null);
    });
  }, [open, sessionId]);

  if (state.success) {
    return <p className="mt-3 text-sm text-emerald-700">{state.success}</p>;
  }

  if (!open) {
    return (
      <div className="mt-3">
        <button type="button" onClick={() => setOpen(true)} className={ui.btnPrimary}>
          I need to reschedule
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-4 border-t border-zinc-100 pt-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="requested_starts_at" value={selectedSlot?.startsAt ?? ""} />
      <input type="hidden" name="requested_ends_at" value={selectedSlot?.endsAt ?? ""} />

      <div>
        <p className="text-sm font-medium text-zinc-900">Choose a new time</p>
        <p className="mt-1 text-xs text-zinc-500">
          Pick a slot from your tutor&apos;s availability — at least 24 hours ahead.
        </p>
        {loadingSlots ? (
          <p className="mt-3 text-sm text-zinc-500">Loading available times…</p>
        ) : slotsError ? (
          <p className="mt-3 text-sm text-rose-600">{slotsError}</p>
        ) : slots.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No available slots in the next few weeks.</p>
        ) : (
          <div className="mt-3">
            <BookingSlotCalendar
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              onClearSlot={() => setSelectedSlot(null)}
            />
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Why do you need to reschedule?
        </label>
        <textarea
          name="message"
          required
          rows={3}
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
          placeholder="Brief explanation for your tutor"
        />
      </div>

      <p className="text-xs text-zinc-500">
        Your tutor will review this request. If they approve, your calendar invite will be updated
        to the new time. Beginners 1-to-1 students get up to 2 reschedules for the course.
      </p>

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !selectedSlot}
          className={ui.btnPrimary}
        >
          {pending ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelectedSlot(null);
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
