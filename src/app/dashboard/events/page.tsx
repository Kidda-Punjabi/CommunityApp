import { EventCard } from "@/components/event-card";
import { canAccessEvent } from "@/lib/membership/access";
import {
  formatRecurrenceLabel,
  splitExpandedEvents,
  type StoredEvent,
} from "@/lib/events/recurrence";
import { normalizeTier } from "@/lib/membership/tiers";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await getCourseAccessContext(supabase, user!);

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: true });

  const { upcoming, past } = splitExpandedEvents((events ?? []) as StoredEvent[]);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Events</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Live sessions and community meetups for Kidda members.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error.message}
        </p>
      )}

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <span className="text-5xl" role="img" aria-hidden="true">
            📅
          </span>
          <p className="mt-4 text-lg font-semibold text-zinc-900">No events yet</p>
          <p className="mt-2 text-sm text-zinc-500">
            New events will appear here when added in admin.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((event) => {
                  const requiredTier = event.required_tier
                    ? normalizeTier(event.required_tier)
                    : null;

                  return (
                    <EventCard
                      key={event.occurrenceId}
                      event={event}
                      canAccess={canAccessEvent(
                        access.unlockedCourseIds,
                        event,
                        access.courses
                      )}
                      requiredTier={
                        requiredTier && requiredTier !== "free" ? requiredTier : null
                      }
                      recurrenceLabel={formatRecurrenceLabel(
                        event.recurrence_freq,
                        event.recurrence_until
                      )}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">Past</h2>
              <div className="space-y-3">
                {past.map((event) => {
                  const requiredTier = event.required_tier
                    ? normalizeTier(event.required_tier)
                    : null;

                  return (
                    <EventCard
                      key={event.occurrenceId}
                      event={event}
                      canAccess={canAccessEvent(
                        access.unlockedCourseIds,
                        event,
                        access.courses
                      )}
                      requiredTier={
                        requiredTier && requiredTier !== "free" ? requiredTier : null
                      }
                      recurrenceLabel={formatRecurrenceLabel(
                        event.recurrence_freq,
                        event.recurrence_until
                      )}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      <p className="mt-8 text-center text-sm text-zinc-500">
        Need access?{" "}
        <Link href="/dashboard/membership" className="font-semibold text-violet-600">
          View your courses
        </Link>
      </p>
    </div>
  );
}
