"use client";

import {
  cancelPendingBooking,
  createOneToOneBooking,
  fetchBookableSlots,
  reserveSlotForPurchase,
  type BookingActionResult,
} from "@/app/dashboard/schedule/booking-actions";
import { BookingSlotCalendar } from "@/components/schedule/booking-slot-calendar";
import { ONE_TO_ONE_SESSION_CHECKOUT_KEY } from "@/lib/products/checkout";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type {
  BookableSlot,
  StudentBookingContext,
  TutorBookingCredit,
  TutorOneToOneBooking,
} from "@/lib/tutoring/availability/types";
import { ui } from "@/lib/ui/styles";
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
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(createOneToOneBooking, initial);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const activeCredit = credits[0] ?? null;
  const showSection = credits.length > 0 || Boolean(context) || bookings.length > 0;
  const canBrowseSlots = Boolean(context?.bookingEnabled && !context.tutorUnresolved);
  const canBookWithCredit = Boolean(canBrowseSlots && activeCredit);
  const canPurchaseWithSlot = Boolean(canBrowseSlots && !activeCredit && checkoutConfigured);
  const tutorLabel = context?.tutorName ?? "your tutor";
  const showPicker = canBrowseSlots && (Boolean(activeCredit) || canPurchaseWithSlot || checkoutConfigured);

  useEffect(() => {
    if (!canBrowseSlots || !context?.tutorId) return;
    startLoadSlots(async () => {
      const result = await fetchBookableSlots(context.tutorId);
      setSlots(result.slots);
      setSlotsError(result.error ?? null);
    });
  }, [canBrowseSlots, context?.tutorId]);

  async function continueToPurchase() {
    if (!selectedSlot || !context?.tutorId) return;

    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const reserved = await reserveSlotForPurchase({
        tutorId: context.tutorId,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
      });

      if (!reserved.bookingId) {
        throw new Error(reserved.error ?? "Could not reserve that time.");
      }

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutKey: ONE_TO_ONE_SESSION_CHECKOUT_KEY,
          oneToOneBookingId: reserved.bookingId,
        }),
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not start checkout.");
      }

      window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed.");
      setCheckoutLoading(false);
    }
  }

  if (!schemaReady) return null;
  if (!showSection) return null;

  const bookAnotherHeading =
    bookings.length > 0 && activeCredit
      ? credits.length === 1
        ? "You have 1 credit left — book another session"
        : `You have ${credits.length} credits left — book another session`
      : activeCredit
        ? credits.length === 1
          ? "Book your session"
          : `Book a session (${credits.length} credits)`
        : "Book a 1-to-1 session";

  return (
    <section className={`${ui.cardBordered} mb-8 space-y-6 p-4`}>
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
        ) : null}
      </div>

      {bookings.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900">
            {bookings.length === 1 ? "Your confirmed session" : "Your confirmed sessions"}
          </h3>
          <ul className="space-y-2">
            {bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900">
                    {formatSessionWhen(booking.startsAt, booking.endsAt)}
                  </p>
                  <p className="text-xs text-zinc-600">Confirmed with {tutorLabel}</p>
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
          {cancelMessage ? <p className="text-sm text-zinc-600">{cancelMessage}</p> : null}
        </div>
      ) : null}

      {canBrowseSlots && showPicker ? (
        <div className="space-y-3 border-t border-zinc-100 pt-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{bookAnotherHeading}</h3>
            {activeCredit ? (
              <p className="mt-1 text-sm text-zinc-500">
                Pick a day, then a time — at least {context?.settings?.bookingBufferHours ?? 24}{" "}
                hours ahead.
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                Choose a day and time first, then pay to confirm. Your slot is held for 20 minutes
                while you check out.
              </p>
            )}
          </div>

          {loadingSlots ? (
            <p className="text-sm text-zinc-500">Loading available times…</p>
          ) : slotsError ? (
            <p className="text-sm text-rose-600">{slotsError}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-zinc-500">No available slots in the next few weeks.</p>
          ) : (
            <BookingSlotCalendar
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => {
                setSelectedSlot(slot);
                setCheckoutError(null);
              }}
              onClearSlot={() => setSelectedSlot(null)}
            />
          )}

          {selectedSlot && canBookWithCredit && context && activeCredit ? (
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

          {selectedSlot && canPurchaseWithSlot ? (
            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-900">Selected: {selectedSlot.label}</p>
              <p className="text-sm text-zinc-600">
                Next you&apos;ll pay securely with Stripe. Your lesson is confirmed as soon as
                payment succeeds.
              </p>
              {checkoutError ? <p className="text-sm text-rose-600">{checkoutError}</p> : null}
              <button
                type="button"
                disabled={checkoutLoading}
                onClick={() => void continueToPurchase()}
                className={ui.btnPrimary}
              >
                {checkoutLoading ? "Reserving…" : "Continue to payment"}
              </button>
            </div>
          ) : null}

          {!activeCredit && !checkoutConfigured && context?.bookingEnabled ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Checkout isn&apos;t configured for 1-to-1 sessions yet. Contact support to book.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
