import Link from "next/link";
import { loadTutorCoverInbox } from "@/app/dashboard/tutor/cover-actions";
import { CalendarSchemaNotice } from "@/components/schedule/calendar-schema-notice";
import { TutorCoverInbox } from "@/components/tutor/tutor-cover-section";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { TutorRequestsInbox } from "@/components/tutor/tutor-requests-section";
import {
  loadTutorPendingCohortSwitchRequests,
  loadTutorPendingRescheduleRequests,
} from "@/lib/calendar/load-sessions";
import { formatCalendarLoadError } from "@/lib/calendar/schema";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

export default async function TutorRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rescheduleLoad: Awaited<ReturnType<typeof loadTutorPendingRescheduleRequests>> = {
    requests: [],
    schemaReady: true,
  };
  let cohortSwitchLoad: Awaited<ReturnType<typeof loadTutorPendingCohortSwitchRequests>> = {
    requests: [],
    schemaReady: true,
  };
  let coverLoad: Awaited<ReturnType<typeof loadTutorCoverInbox>> = { items: [] };
  let loadError: string | null = null;

  try {
    [rescheduleLoad, cohortSwitchLoad, coverLoad] = await Promise.all([
      loadTutorPendingRescheduleRequests(supabase, user!.id),
      loadTutorPendingCohortSwitchRequests(supabase, user!.id),
      loadTutorCoverInbox(user!.id),
    ]);
  } catch (error) {
    loadError = formatCalendarLoadError(error);
  }

  const schemaReady = rescheduleLoad.schemaReady && cohortSwitchLoad.schemaReady;
  const totalPending = rescheduleLoad.requests.length + cohortSwitchLoad.requests.length;

  return (
    <div className={ui.page}>
      <TutorPageHeader
        title="Student requests"
        subtitle="Review reschedule and alternate cohort requests, plus cover assignments."
      />

      {loadError ? (
        <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</p>
      ) : null}

      {!schemaReady ? <CalendarSchemaNotice className="mb-6" /> : null}

      {totalPending > 0 ? (
        <p className="mb-6 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
          {totalPending} pending request{totalPending === 1 ? "" : "s"} waiting for your response.
        </p>
      ) : null}

      <TutorCoverInbox items={coverLoad.items} />
      {coverLoad.error ? <p className="mb-4 text-sm text-amber-700">{coverLoad.error}</p> : null}

      <TutorRequestsInbox
        rescheduleRequests={rescheduleLoad.requests}
        cohortSwitchRequests={cohortSwitchLoad.requests}
      />

      <p className="mt-8 text-center text-sm text-zinc-500">
        <Link
          href="/dashboard/tutor/calendar"
          className="font-medium text-violet-600 hover:text-violet-500"
        >
          Back to calendar
        </Link>
      </p>
    </div>
  );
}
