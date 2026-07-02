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
import { loadHomeworkDueForStudent } from "@/lib/tutoring/homework-reminders";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

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

  const [
    { sessions, schemaReady },
    bookingContextLoad,
    studentBookingsLoad,
    creditsLoad,
    checkoutConfigured,
    homeworkDue,
  ] =
    await Promise.all([
      loadStudentUpcomingSessions(supabase, user!.id, user!.email),
      loadStudentBookingContext(supabase, user!.id),
      loadStudentBookings(supabase, user!.id),
      loadAvailableBookingCredits(supabase, user!.id),
      isOneToOneSessionCheckoutConfigured(),
      loadHomeworkDueForStudent(supabase, user!.id),
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

      {homeworkDue ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Homework due before your next lesson</p>
          <p className="mt-1">
            You still need to submit homework for <span className="font-medium">{homeworkDue.lessonTitle}</span>.
            {" "}Your next lesson starts{" "}
            {new Date(homeworkDue.nextLessonStartsAt).toLocaleString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </p>
          <Link href="/dashboard/learn" className="mt-2 inline-block font-semibold underline">
            Go to Learn and submit homework →
          </Link>
        </div>
      ) : null}

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
