"use client";

import {
  cancelPendingBooking,
  createOneToOneBooking,
  fetchBookableSlots,
  type BookingActionResult,
} from "@/app/dashboard/schedule/booking-actions";
import { BuyButton } from "@/components/products/buy-button";
import { ONE_TO_ONE_SESSION_CHECKOUT_KEY } from "@/lib/products/checkout";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type {
  BookableSlot,
  StudentBookingContext,
  TutorBookingCredit,
  TutorOneToOneBooking,
} from "@/lib/tutoring/availability/types";
import { cn, ui } from "@/lib/ui/styles";
import { useActionState, useEffect, useState, useTransition } from "react";

const initial: BookingActionResult = {};

type BookOneToOneSectionProps = {
  context: StudentBookingContext | null;
  bookings: TutorOneToOneBooking[];
  credits: TutorBookingCredit[];
  checkoutConfigured: boolean;
  paymentMessage?: string | null;
  schemaReady: boolean;
};

export function BookOneToOneSection({
  context,
  bookings,
  credits,
  checkoutConfigured,
  paymentMessage,
  schemaReady,
}: BookOneToOneSectionProps) {
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null);
  const [loadingSlots, startLoadSlots] = useTransition();
  const [state, formAction, pending] = useActionState(createOneToOneBooking, initial);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const activeCredit = credits[0] ?? null;
  const showSection = credits.length > 0 || Boolean(context);
  const canBook = Boolean(context?.bookingEnabled && activeCredit && !context.tutorUnresolved);
  const tutorLabel = context?.tutorName ?? "your tutor";

  useEffect(() => {
    if (!canBook || !context?.tutorId) return;
    startLoadSlots(async () => {
      const result = await fetchBookableSlots(context.tutorId);
      setSlots(result.slots);
      setSlotsError(result.error ?? null);
    });
  }, [canBook, context?.tutorId]);

  if (!schemaReady) return null;
  if (!showSection) return null;

  return (
    <section className={`${ui.cardBordered} mb-8 space-y-4 p-4`}>
      <div>
        <h2 className={ui.sectionTitle}>
          {context?.tutorUnresolved
            ? "Book a 1-to-1 lesson"
            : `Book a 1-to-1 with ${tutorLabel}`}
        </h2>
        {paymentMessage ? (
          <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {paymentMessage}
          </p>
        ) : null}
        {context?.tutorUnresolved ? (
          <p className="mt-1 text-sm text-zinc-500">
            You have a paid session credit, but we could not match you to a tutor for self-serve
            booking. Contact support and we will get you scheduled.
          </p>
        ) : !context?.bookingEnabled && activeCredit ? (
          <p className="mt-1 text-sm text-zinc-500">
            You have {credits.length} paid session credit{credits.length === 1 ? "" : "s"}.{" "}
            {tutorLabel} hasn&apos;t opened self-serve booking yet — message them to schedule, or
            check back here when booking is enabled.
          </p>
        ) : !context?.bookingEnabled ? (
          <p className="mt-1 text-sm text-zinc-500">
            Your tutor hasn&apos;t opened self-serve booking yet. Contact them to schedule a lesson.
          </p>
        ) : activeCredit ? (
          <p className="mt-1 text-sm text-zinc-500">
            You have {credits.length} paid session credit{credits.length === 1 ? "" : "s"}.
            Pick a time at least {context.settings?.bookingBufferHours ?? 24} hours ahead.
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">
            Purchase a 1-to-1 session first, then choose a time that works for you and your tutor.
          </p>
        )}
      </div>

      {bookings.length > 0 ? (
        <ul className="space-y-2">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-zinc-900">
                  {formatSessionWhen(booking.startsAt, booking.endsAt)}
                </p>
                <p className="text-xs text-zinc-500">Confirmed with {tutorLabel}</p>
              </div>
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() => {
                  void cancelPendingBooking(booking.id).then((result) => {
                    setCancelMessage(result.success ?? result.error ?? null);
                  });
                }}
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {cancelMessage ? <p className="text-sm text-zinc-600">{cancelMessage}</p> : null}

      {context && !context.tutorUnresolved && context.bookingEnabled && !activeCredit ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="mb-3 text-sm text-violet-900">
            Pay securely with Stripe to unlock the calendar and book your lesson.
          </p>
          <BuyButton
            checkoutKey={ONE_TO_ONE_SESSION_CHECKOUT_KEY}
            label="Purchase 1-to-1 session"
            configured={checkoutConfigured}
            className={ui.btnPrimary}
          />
        </div>
      ) : null}

      {canBook ? (
        <>
          {loadingSlots ? (
            <p className="text-sm text-zinc-500">Loading available times…</p>
          ) : slotsError ? (
            <p className="text-sm text-rose-600">{slotsError}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-zinc-500">No available slots in the next few weeks.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    selectedSlot?.startsAt === slot.startsAt
                      ? "border-violet-400 bg-violet-50 text-violet-900"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}

          {selectedSlot && activeCredit && context ? (
            <form action={formAction} className="space-y-3 border-t border-zinc-100 pt-4">
              <input type="hidden" name="tutor_id" value={context.tutorId} />
              <input type="hidden" name="starts_at" value={selectedSlot.startsAt} />
              <input type="hidden" name="ends_at" value={selectedSlot.endsAt} />
              <input type="hidden" name="credit_id" value={activeCredit.id} />
              <p className="text-sm font-medium text-zinc-900">Selected: {selectedSlot.label}</p>
              <textarea
                name="notes"
                rows={2}
                placeholder="Optional note for your tutor"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
              {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
              {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
              <button type="submit" disabled={pending} className={ui.btnPrimary}>
                {pending ? "Booking…" : "Confirm lesson time"}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
