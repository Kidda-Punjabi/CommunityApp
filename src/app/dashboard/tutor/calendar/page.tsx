import { GoogleCalendarSetupNotice } from "@/components/tutor/google-calendar-setup-notice";
import { CalendarSchemaNotice } from "@/components/schedule/calendar-schema-notice";
import Link from "next/link";
import { TutorCalendarAutoSync } from "@/components/tutor/tutor-calendar-auto-sync";
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
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { formatGoogleCalendarError } from "@/lib/calendar/format-google-error";
import { isGoogleOAuthConfigured } from "@/lib/calendar/google-oauth";
import { formatCalendarLoadError } from "@/lib/calendar/schema";
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

  const params = await searchParams;
  const status = await loadTutorCalendarStatus(supabase);

  let sessionLoad: Awaited<ReturnType<typeof loadTutorUpcomingSessions>> = {
    sessions: [],
    schemaReady: status.schemaReady,
  };
  let requestLoad: Awaited<ReturnType<typeof loadTutorPendingRescheduleRequests>> = {
    requests: [],
    schemaReady: status.schemaReady,
  };
  let loadError: string | null = null;

  try {
    [sessionLoad, requestLoad] = await Promise.all([
      loadTutorUpcomingSessions(supabase, user!.id),
      loadTutorPendingRescheduleRequests(supabase, user!.id),
    ]);
  } catch (error) {
    loadError = formatCalendarLoadError(error);
  }

  const schemaReady =
    status.schemaReady && sessionLoad.schemaReady && requestLoad.schemaReady;
  const sessions = sessionLoad.sessions;
  const requests = requestLoad.requests;

  const oauthConfigured = isGoogleOAuthConfigured();
  const showAdminSetup =
    process.env.NODE_ENV === "development" ||
    (await canAccessAdminPanel(user, supabase));
  const justConnected = params.connected === "1";
  const connectError = params.error
    ? formatGoogleCalendarError(decodeURIComponent(params.error))
    : null;

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

      {loadError ? (
        <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
        </p>
      ) : null}

      {!schemaReady ? <CalendarSchemaNotice className="mb-6" /> : null}

      <section className={`${ui.card} mb-8 space-y-4`}>
        <h2 className="font-heading text-lg font-semibold text-zinc-900">Google Calendar</h2>

        {!oauthConfigured ? <GoogleCalendarSetupNotice showAdminSetup={showAdminSetup} /> : null}

        {schemaReady && status.connected ? (
          <>
            <TutorCalendarAutoSync
              connected={status.connected}
              lastSyncedAt={status.lastSyncedAt}
            />
            <p className="text-sm text-zinc-600">
              Connected as <span className="font-medium">{status.googleAccountEmail}</span>
              {status.lastSyncedAt
                ? ` · Last synced ${new Date(status.lastSyncedAt).toLocaleString("en-GB")}`
                : ""}
              {" · "}
              Auto-syncs when you open this page and every 15 minutes on the server.
            </p>
            <TutorCalendarSyncButton />
            <form action={disconnectGoogleCalendar}>
              <button type="submit" className={ui.btnGhost}>
                Disconnect
              </button>
            </form>
          </>
        ) : schemaReady ? (
          <>
            <p className="text-sm text-zinc-600">
              Sync lessons from your Google Calendar. Only events with a student&apos;s Kidda
              email on the invite are imported and shown to them.
            </p>
            {oauthConfigured ? (
              <Link href="/api/google/calendar/connect" className={ui.btnPrimary}>
                Connect Google Calendar
              </Link>
            ) : null}
          </>
        ) : null}
      </section>

      <TutorRescheduleInbox requests={requests} />

      <section className="mt-8">
        <h2 className={ui.sectionTitle}>Upcoming lessons</h2>
        <TutorUpcomingSessionsList sessions={sessions} />
      </section>
    </div>
  );
}
