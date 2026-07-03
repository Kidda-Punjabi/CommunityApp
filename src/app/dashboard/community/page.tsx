import { EventCard } from "@/components/event-card";
import { FeaturedTestimonialCard } from "@/components/community/featured-testimonial-card";
import { WeeklyLeaderboardCard } from "@/components/community/weekly-leaderboard-card";
import { FriendsSummaryRow } from "@/components/profile/friends-summary-row";
import { loadFeaturedTestimonial } from "@/lib/community/load-featured-testimonial";
import { prepareCommunityEvents } from "@/lib/community/prepare-events";
import { loadFriendsProfileData } from "@/lib/friends/load-friends";
import { loadLeaderboard } from "@/lib/leaderboard/load-leaderboard";
import { getCurrentWeekStart } from "@/lib/leaderboard/week";
import { splitExpandedEvents, type StoredEvent } from "@/lib/events/recurrence";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { getUserActivityDate } from "@/lib/progress/server-activity-date";
import { ui } from "@/lib/ui/styles";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const PREVIEW_EVENT_COUNT = 2;

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activityDate = await getUserActivityDate();
  const currentWeekStart = getCurrentWeekStart(activityDate);

  const [access, friendsData, leaderboard, testimonial, eventsResult] = await Promise.all([
    getCourseAccessContext(supabase, user!),
    loadFriendsProfileData(supabase, user!.id),
    loadLeaderboard(supabase, currentWeekStart, user!.id),
    loadFeaturedTestimonial(supabase),
    supabase.from("events").select("*").order("starts_at", { ascending: true }),
  ]);

  const { upcoming } = splitExpandedEvents((eventsResult.data ?? []) as StoredEvent[]);
  const preparedUpcoming = prepareCommunityEvents(upcoming, access);
  const previewEvents = preparedUpcoming.slice(0, PREVIEW_EVENT_COUNT);

  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Community</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Leaderboard, live sessions, and friends learning with you.
        </p>
      </div>

      <div className={ui.stackLoose}>
        <section id="leaderboard" className="scroll-mt-4">
          <WeeklyLeaderboardCard data={leaderboard} />
        </section>

        {previewEvents.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-zinc-900">Upcoming events</h2>
              {preparedUpcoming.length > 0 && (
                <Link
                  href="/dashboard/community/events"
                  className="text-sm font-medium text-violet-600 hover:text-violet-500"
                >
                  See all
                </Link>
              )}
            </div>
            <div className={ui.stack}>
              {previewEvents.map(({ event, canAccess, requiredTier, recurrenceLabel }) => (
                <EventCard
                  key={event.occurrenceId}
                  event={event}
                  canAccess={canAccess}
                  requiredTier={requiredTier}
                  recurrenceLabel={recurrenceLabel}
                />
              ))}
            </div>
          </section>
        )}

        <FriendsSummaryRow friends={friendsData.friends} variant="community" />

        {testimonial ? <FeaturedTestimonialCard testimonial={testimonial} /> : null}
      </div>
    </div>
  );
}
