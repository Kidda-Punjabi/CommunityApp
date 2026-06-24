import Link from "next/link";
import { TutorCalendarSyncButton } from "@/components/tutor/tutor-calendar-sync-button";
import {
  TutorRescheduleInbox,
  TutorUpcomingSessionsList,
} from "@/components/tutor/tutor-calendar-section";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { disconnectGoogleCalendar } from "@/app/dashboard/tutor/calendar-actions";
import {
  loadTutorCalendarStatus,
  loadTutorPendingRescheduleRequests,
  loadTutorUpcomingSessions,
} from "@/lib/calendar/load-sessions";
import { getGoogleOAuthConfig } from "@/lib/calendar/google-oauth";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

type TutorCalendarPageProps = {
  searchParams: Promise<{ connected?: string; error?: string }>;
};

export default async function TutorCalendarPage({ searchParams }: TutorCalendarPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [params, status, sessions, requests] = await Promise.all([
    searchParams,
    loadTutorCalendarStatus(supabase),
    loadTutorUpcomingSessions(supabase, user!.id),
    loadTutorPendingRescheduleRequests(supabase, user!.id),
  ]);

  const oauthConfigured = Boolean(getGoogleOAuthConfig());
  const justConnected = params.connected === "1";
  const connectError = params.error ? decodeURIComponent(params.error) : null;

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Calendar"
        subtitle="Connect Google Calendar to show upcoming lessons and join links to your students."
      />

      {justConnected ? (
        <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Google Calendar connected successfully.
        </p>
      ) : null}

      {connectError ? (
        <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {connectError}
        </p>
      ) : null}

      <section className={`${ui.card} mb-8 space-y-4`}>
        <h2 className="font-heading text-lg font-semibold text-zinc-900">Google Calendar</h2>

        {!oauthConfigured ? (
          <p className="text-sm text-amber-800">
            Google Calendar OAuth is not configured on this environment yet. Ask an admin to set{" "}
            <code className="text-xs">GOOGLE_CALENDAR_CLIENT_ID</code>,{" "}
            <code className="text-xs">GOOGLE_CALENDAR_CLIENT_SECRET</code>, and{" "}
            <code className="text-xs">GOOGLE_CALENDAR_REDIRECT_URI</code>.
          </p>
        ) : null}

        {status.connected ? (
          <>
            <p className="text-sm text-zinc-600">
              Connected as <span className="font-medium">{status.googleAccountEmail}</span>
              {status.lastSyncedAt
                ? ` · Last synced ${new Date(status.lastSyncedAt).toLocaleString()}`
                : ""}
            </p>
            <TutorCalendarSyncButton />
            <form action={disconnectGoogleCalendar}>
              <button type="submit" className={ui.btnGhost}>
                Disconnect
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-600">
              Sync lessons from your Google Calendar. Events are matched to students when their
              email is on the invite or their name appears in the event title.
            </p>
            {oauthConfigured ? (
              <Link href="/api/google/calendar/connect" className={ui.btnPrimary}>
                Connect Google Calendar
              </Link>
            ) : null}
          </>
        )}
      </section>

      <TutorRescheduleInbox requests={requests} />

      <section className="mt-8">
        <h2 className={ui.sectionTitle}>Upcoming lessons</h2>
        <TutorUpcomingSessionsList sessions={sessions} />
      </section>
    </div>
  );
}
