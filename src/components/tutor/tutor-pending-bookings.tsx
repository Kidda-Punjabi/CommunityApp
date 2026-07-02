import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type { TutorOneToOneBooking } from "@/lib/tutoring/availability/types";
import { ui } from "@/lib/ui/styles";

type TutorPendingBookingsProps = {
  bookings: Array<TutorOneToOneBooking & { studentName: string }>;
};

export function TutorPendingBookings({ bookings }: TutorPendingBookingsProps) {
  if (bookings.length === 0) return null;

  return (
    <section className={`${ui.cardBordered} mb-8 space-y-3 p-4`}>
      <h2 className={ui.sectionTitle}>Member booking requests</h2>
      <ul className="space-y-2">
        {bookings.map((booking) => (
          <li
            key={booking.id}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          >
            <p className="font-medium text-zinc-900">{booking.studentName}</p>
            <p className="text-zinc-600">
              {formatSessionWhen(booking.startsAt, booking.endsAt)}
            </p>
            <p className="text-xs text-zinc-500">
              {booking.status === "pending_payment"
                ? "Pending payment — add to Google Calendar once confirmed"
                : "Confirmed"}
            </p>
            {booking.notes ? (
              <p className="mt-1 text-xs text-zinc-500">Note: {booking.notes}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
