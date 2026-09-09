"use client";

import { useActionState, useEffect, useState, useTransition, type FormEvent } from "react";
import { requestLessonReschedule, type CalendarActionResult } from "@/app/dashboard/tutor/calendar-actions";
import { fetchRescheduleSlotsForSession } from "@/app/dashboard/schedule/reschedule-actions";
import { BookingSlotCalendar } from "@/components/schedule/booking-slot-calendar";
import type { RescheduleSubmitInput } from "@/lib/calendar/schedule-preview";
import type { BookableSlot } from "@/lib/tutoring/availability/types";
import { ui } from "@/lib/ui/styles";

const initial: CalendarActionResult = {};

export function RescheduleRequestForm({
  sessionId,
  isLateCancel = false,
  onDone,
  onSubmit,
  loadSlots,
}: {
  sessionId: string;
  isLateCancel?: boolean;
  onDone?: () => void;
  onSubmit?: (input: RescheduleSubmitInput) => Promise<CalendarActionResult>;
  loadSlots?: (sessionId: string) => Promise<{ slots: BookableSlot[]; error?: string }>;
}) {
  const [state, action, pendingAction] = useActionState(requestLessonReschedule, initial);
  const [overrideState, setOverrideState] = useState<CalendarActionResult>({});
  const [overridePending, setOverridePending] = useState(false);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null);
  const [loadingSlots, startLoadSlots] = useTransition();

  const usingOverride = Boolean(onSubmit);
  const shownState = usingOverride ? overrideState : state;
  const pending = usingOverride ? overridePending : pendingAction;

  useEffect(() => {
    if (!open || isLateCancel) return;
    startLoadSlots(async () => {
      const result = loadSlots
        ? await loadSlots(sessionId)
        : await fetchRescheduleSlotsForSession(sessionId);
      setSlots(result.slots);
      setSlotsError(result.error ?? null);
      setSelectedSlot(null);
    });
  }, [open, sessionId, isLateCancel, loadSlots]);

  async function handleOverrideSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSubmit) return;
    const formData = new FormData(event.currentTarget);
    setOverridePending(true);
    const result = await onSubmit({
      sessionId: String(formData.get("session_id") ?? ""),
      message: String(formData.get("message") ?? "").trim(),
      lateCancel: String(formData.get("late_cancel")) === "1",
      requestedStartsAt: String(formData.get("requested_starts_at") || "") || null,
      requestedEndsAt: String(formData.get("requested_ends_at") || "") || null,
    });
    setOverrideState(result);
    setOverridePending(false);
  }

  if (shownState.success) {
    return <p className="mt-3 text-sm text-emerald-700">{shownState.success}</p>;
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

  return (
    <form
      action={usingOverride ? undefined : action}
      onSubmit={usingOverride ? handleOverrideSubmit : undefined}
      className="mt-3 space-y-4 border-t border-zinc-100 pt-3"
    >
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="late_cancel" value={isLateCancel ? "1" : "0"} />
      <input type="hidden" name="requested_starts_at" value={selectedSlot?.startsAt ?? ""} />
      <input type="hidden" name="requested_ends_at" value={selectedSlot?.endsAt ?? ""} />

      {isLateCancel ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This lesson starts within 24 hours, so it can&apos;t be moved. Tell your tutor you
          can&apos;t attend — if they confirm, Session catch-up unlocks for this lesson instead of
          a recording.
        </div>
      ) : (
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
          : "Your tutor will review this request. If they approve, your calendar invite will be updated to the new time. Beginners 1-to-1 students get up to 2 reschedules for the course."}
      </p>

      {shownState.error ? <p className="text-sm text-rose-600">{shownState.error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || (!isLateCancel && !selectedSlot)}
          className={ui.btnPrimary}
        >
          {pending ? "Sending…" : isLateCancel ? "Send late cancel" : "Send request"}
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
