"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { requestLessonReschedule, type CalendarActionResult } from "@/app/dashboard/tutor/calendar-actions";
import { startPaidSessionRebook } from "@/app/dashboard/schedule/rebook-actions";
import { fetchRescheduleSlotsForSession } from "@/app/dashboard/schedule/reschedule-actions";
import { BookingSlotCalendar } from "@/components/schedule/booking-slot-calendar";
import { RESCHEDULE_CUTOFF_MS } from "@/lib/calendar/constants";
import { BEGINNERS_RESCHEDULE_LIMIT } from "@/lib/calendar/reschedule-limit";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};
const PREFERRED_SLOT_COUNT = 3;
const cutoffHours = RESCHEDULE_CUTOFF_MS / (60 * 60 * 1000);

type LatePath = "choose" | "catchup" | "paid";

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
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null);
  const [latePath, setLatePath] = useState<LatePath>("choose");
  const [rebookError, setRebookError] = useState<string | null>(null);
  const [loadingSlots, startLoadSlots] = useTransition();
  const [rebookPending, startRebook] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (isLateCancel && latePath !== "paid") return;
    if (!isLateCancel || latePath === "paid") {
      startLoadSlots(async () => {
        const result = await fetchRescheduleSlotsForSession(sessionId);
        setSlots(result.slots);
        setSlotsError(result.error ?? null);
        setSelectedSlots([]);
        setSelectedSlot(null);
      });
    }
  }, [open, sessionId, isLateCancel, latePath]);

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

  if (isLateCancel && latePath === "choose") {
    return (
      <div className="mt-3 space-y-4 border-t border-zinc-100 pt-3">
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This lesson starts within {cutoffHours} hours. Choose how you&apos;d like to handle it —
          either option uses one of your course reschedule/cancellation allowances.
        </div>
        <button
          type="button"
          onClick={() => setLatePath("paid")}
          className={ui.btnPrimaryBlock}
        >
          Pay £35 to rebook a live session
        </button>
        <button
          type="button"
          onClick={() => setLatePath("catchup")}
          className={ui.btnSecondary}
        >
          Free async Session catch-up
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setLatePath("choose");
            onDone?.();
          }}
          className={ui.btnGhost}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (isLateCancel && latePath === "paid") {
    return (
      <div className="mt-3 space-y-4 border-t border-zinc-100 pt-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">Choose a new live time</p>
          <p className="mt-1 text-xs text-zinc-500">
            New times must be at least {cutoffHours} hours from now so your tutor has notice. After
            you pay £35, the lesson moves automatically and you both get email confirmation.
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
        {rebookError ? <p className="text-sm text-rose-600">{rebookError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!selectedSlot || rebookPending}
            onClick={() => {
              if (!selectedSlot) return;
              setRebookError(null);
              startRebook(async () => {
                const result = await startPaidSessionRebook({
                  sessionId,
                  startsAt: selectedSlot.startsAt,
                  endsAt: selectedSlot.endsAt,
                });
                if (result.error) {
                  setRebookError(result.error);
                  return;
                }
                if (result.checkoutUrl) {
                  window.location.href = result.checkoutUrl;
                }
              });
            }}
            className={ui.btnPrimary}
          >
            {rebookPending ? "Preparing checkout…" : "Continue to £35 payment"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLatePath("choose");
              setSelectedSlot(null);
              setRebookError(null);
            }}
            className={ui.btnGhost}
          >
            Back
          </button>
        </div>
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
          You&apos;ve chosen free Session catch-up. Tell your tutor you can&apos;t attend — if they
          confirm, catch-up unlocks for this lesson instead of a recording. This still uses one
          reschedule/cancellation allowance.
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
          ? "Your tutor will review this. If they confirm, Week content unlocks with Session catch-up in place of the recording."
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
            if (isLateCancel) {
              setLatePath("choose");
              return;
            }
            setOpen(false);
            setSelectedSlots([]);
            onDone?.();
          }}
          className={ui.btnGhost}
        >
          {isLateCancel ? "Back" : "Cancel"}
        </button>
      </div>
    </form>
  );
}
