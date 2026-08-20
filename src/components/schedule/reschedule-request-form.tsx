"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { requestLessonReschedule, type CalendarActionResult } from "@/app/dashboard/tutor/calendar-actions";
import { fetchRescheduleSlotsForSession } from "@/app/dashboard/schedule/reschedule-actions";
import { BookingSlotCalendar } from "@/components/schedule/booking-slot-calendar";
import { RESCHEDULE_CUTOFF_MS } from "@/lib/calendar/constants";
import { BEGINNERS_RESCHEDULE_LIMIT } from "@/lib/calendar/reschedule-limit";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};
const PREFERRED_SLOT_COUNT = 3;
const cutoffHours = RESCHEDULE_CUTOFF_MS / (60 * 60 * 1000);

export function RescheduleRequestForm({
  sessionId,
  isLateCancel = false,
  onDone,
}: {
  sessionId: string;
  isLateCancel?: boolean;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(requestLessonReschedule, initial);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<BookableSlot[]>([]);
  const [loadingSlots, startLoadSlots] = useTransition();

  useEffect(() => {
    if (!open || isLateCancel) return;
    startLoadSlots(async () => {
      const result = await fetchRescheduleSlotsForSession(sessionId);
      setSlots(result.slots);
      setSlotsError(result.error ?? null);
      setSelectedSlots([]);
    });
  }, [open, sessionId, isLateCancel]);

  if (state.success) {
    return <p className="mt-3 text-sm text-emerald-700">{state.success}</p>;
  }

  if (!open) {
    return (
      <div className="mt-3">
        <button type="button" onClick={() => setOpen(true)} className={ui.btnPrimary}>
          {isLateCancel ? "I can't make this lesson" : "I need to reschedule"}
        </button>
      </div>
    );
  }

  const canSubmitFreeReschedule = selectedSlots.length === PREFERRED_SLOT_COUNT;

  return (
    <form action={action} className="mt-3 space-y-4 border-t border-zinc-100 pt-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="late_cancel" value={isLateCancel ? "1" : "0"} />
      <input
        type="hidden"
        name="requested_slots"
        value={JSON.stringify(
          selectedSlots.map((slot) => ({
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          }))
        )}
      />

      {isLateCancel ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This lesson starts within {cutoffHours} hours, so it can&apos;t be moved for free. Tell
          your tutor you can&apos;t attend — if they confirm, Session catch-up unlocks for this
          lesson instead of a recording.
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-zinc-900">
            Choose {PREFERRED_SLOT_COUNT} preferred times
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Pick {PREFERRED_SLOT_COUNT} open slots from your tutor&apos;s calendar — each must be
            at least {cutoffHours} hours ahead. Your tutor confirms one within 24 hours.
          </p>
          {loadingSlots ? (
            <p className="mt-3 text-sm text-zinc-500">Loading available times…</p>
          ) : slotsError ? (
            <p className="mt-3 text-sm text-rose-600">{slotsError}</p>
          ) : slots.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No available slots in the next few weeks.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <BookingSlotCalendar
                slots={slots}
                selectedSlots={selectedSlots}
                maxSelections={PREFERRED_SLOT_COUNT}
                onChangeSelectedSlots={setSelectedSlots}
              />
              <p className="text-xs text-zinc-500">
                {selectedSlots.length} of {PREFERRED_SLOT_COUNT} preferred times selected
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          {isLateCancel ? "Why can't you make this lesson?" : "Why do you need to reschedule?"}
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
        {isLateCancel
          ? "Your tutor will review this. If they can't move the lesson, Week content unlocks with Session catch-up in place of the recording."
          : `Your tutor will review this request and confirm one of your preferred times. Beginners students get up to ${BEGINNERS_RESCHEDULE_LIMIT} reschedules/cancellations for the course.`}
      </p>

      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || (!isLateCancel && !canSubmitFreeReschedule)}
          className={ui.btnPrimary}
        >
          {pending ? "Sending…" : isLateCancel ? "Send late cancel" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelectedSlots([]);
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
