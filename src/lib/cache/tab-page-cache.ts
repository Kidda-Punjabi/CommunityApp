import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getHomeDashboardData } from "@/lib/dashboard/home-data";
import { loadViewerWeeklyPoints } from "@/lib/leaderboard/load-viewer-weekly-points";
import { getCurrentWeekStart } from "@/lib/leaderboard/week";
import { loadUnreadNotificationCount } from "@/lib/notifications/load-notifications";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { getUserActivityDate } from "@/lib/progress/server-activity-date";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { fetchPersonalBestsByGame } from "@/lib/games/game-scores";
import { loadFeaturedTestimonial } from "@/lib/community/load-featured-testimonial";
import { prepareCommunityEvents } from "@/lib/community/prepare-events";
import { loadFriendsProfileData } from "@/lib/friends/load-friends";
import { loadLeaderboard } from "@/lib/leaderboard/load-leaderboard";
import { splitExpandedEvents, type StoredEvent } from "@/lib/events/recurrence";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";

const TAB_STALE_SECONDS = 30;

export function getCachedHomeTabData(userId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error("Not authenticated");
      }

      const activityDate = await getUserActivityDate();
      const currentWeekStart = getCurrentWeekStart(activityDate);

      const [dashboard, profile, onboarding, unreadNotificationCount, weeklyPoints] =
        await Promise.all([
          getHomeDashboardData(supabase, user),
          loadEditableProfile(supabase, userId),
          loadOnboardingProfile(supabase, userId),
          loadUnreadNotificationCount(supabase, userId),
          loadViewerWeeklyPoints(supabase, userId, currentWeekStart),
        ]);

      return {
        dashboard,
        profile,
        onboarding,
        unreadNotificationCount,
        weeklyPoints,
        activityDate,
        currentWeekStart,
      };
    },
    ["tab-home", userId],
    { revalidate: TAB_STALE_SECONDS }
  )();
}

export function getCachedGamesTabData(userId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const personalBestsMap = await fetchPersonalBestsByGame(supabase, userId);
      const personalBests: Record<string, number> = {};
      for (const [type, score] of personalBestsMap.entries()) {
        personalBests[type] = score;
      }
      return personalBests;
    },
    ["tab-games", userId],
    { revalidate: TAB_STALE_SECONDS }
  )();
}

export function getCachedCommunityTabData(userId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const activityDate = await getUserActivityDate();
      const currentWeekStart = getCurrentWeekStart(activityDate);

      const [access, friendsData, leaderboard, testimonial, eventsResult] =
        await Promise.all([
          getCourseAccessContext(supabase, user),
          loadFriendsProfileData(supabase, userId),
          loadLeaderboard(supabase, currentWeekStart, userId),
          loadFeaturedTestimonial(supabase),
          supabase.from("events").select("*").order("starts_at", { ascending: true }),
        ]);

      const { upcoming } = splitExpandedEvents((eventsResult.data ?? []) as StoredEvent[]);
      const preparedUpcoming = prepareCommunityEvents(upcoming, access);

      return {
        access,
        friendsData,
        leaderboard,
        testimonial,
        preparedUpcoming,
      };
    },
    ["tab-community", userId],
    { revalidate: TAB_STALE_SECONDS }
  )();
}

export function getCachedTutorDashboard(userId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      return loadTutorDashboard(supabase, userId);
    },
    ["tab-tutor-dashboard", userId],
    { revalidate: TAB_STALE_SECONDS }
  )();
}
