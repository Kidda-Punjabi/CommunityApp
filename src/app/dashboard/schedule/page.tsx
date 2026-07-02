import { BookOneToOneSection } from "@/components/schedule/book-one-to-one-section";
import { CalendarSchemaNotice } from "@/components/schedule/calendar-schema-notice";
import { UpcomingLessonsList } from "@/components/schedule/upcoming-lessons-list";
import {
  isOneToOneSessionCheckoutConfigured,
  syncBookingPayment,
} from "@/app/dashboard/schedule/booking-actions";
import { loadStudentUpcomingSessions } from "@/lib/calendar/load-sessions";
import {
  loadAvailableBookingCredits,
  loadStudentBookingContext,
  loadStudentBookings,
} from "@/lib/tutoring/availability/load-availability";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

type StudentSchedulePageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function StudentSchedulePage({ searchParams }: StudentSchedulePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  let paymentMessage: string | null = null;
  if (params.session_id) {
    const syncResult = await syncBookingPayment(params.session_id);
    paymentMessage = syncResult.success ?? syncResult.error ?? null;
  }

  const [{ sessions, schemaReady }, bookingContextLoad, studentBookingsLoad, creditsLoad, checkoutConfigured] =
    await Promise.all([
      loadStudentUpcomingSessions(supabase, user!.id, user!.email),
      loadStudentBookingContext(supabase, user!.id),
      loadStudentBookings(supabase, user!.id),
      loadAvailableBookingCredits(supabase, user!.id),
      isOneToOneSessionCheckoutConfigured(),
    ]);

  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Upcoming lessons</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Live sessions with your tutor. Join from here when it&apos;s time.
        </p>
      </div>

      {!schemaReady ? <CalendarSchemaNotice className="mb-6" /> : null}

      <BookOneToOneSection
        context={bookingContextLoad.context}
        bookings={studentBookingsLoad.bookings}
        credits={creditsLoad.credits}
        checkoutConfigured={checkoutConfigured}
        paymentMessage={paymentMessage}
        schemaReady={bookingContextLoad.schemaReady && studentBookingsLoad.schemaReady && creditsLoad.schemaReady}
      />

      <UpcomingLessonsList sessions={sessions} />
    </div>
  );
}
