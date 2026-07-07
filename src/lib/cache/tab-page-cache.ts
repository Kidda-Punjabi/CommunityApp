import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getHomeDashboardData } from "@/lib/dashboard/home-data";
import { loadViewerWeeklyPoints } from "@/lib/leaderboard/load-viewer-weekly-points";
import { getCurrentWeekStart } from "@/lib/leaderboard/week";
import { loadUnreadNotificationCount } from "@/lib/notifications/load-notifications";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { getUserActivityDate } from "@/lib/progress/server-activity-date";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { fetchPersonalBestsByGame } from "@/lib/games/game-scores";
import { prepareCommunityEvents } from "@/lib/community/prepare-events";
import { loadFriendsProfileData } from "@/lib/friends/load-friends";
import { loadLeaderboard } from "@/lib/leaderboard/load-leaderboard";
import { loadForumOnboardingState } from "@/lib/forum/access";
import { loadForumPostPreviews } from "@/lib/forum/load-forum";
import { splitExpandedEvents, type StoredEvent } from "@/lib/events/recurrence";
import { getCachedCourseAccess } from "@/lib/supabase/cached-session";
import { loadTutorDashboard } from "@/lib/tutoring/load-tutor-dashboard";

/** Per-request dedup — safe with cookies/auth (not cross-request like unstable_cache). */
export const getHomeTabData = cache(async (userId: string) => {
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
});

export const getGamesTabData = cache(async (userId: string) => {
  const supabase = await createClient();
  const personalBestsMap = await fetchPersonalBestsByGame(supabase, userId);
  const personalBests: Record<string, number> = {};
  for (const [type, score] of personalBestsMap.entries()) {
    personalBests[type] = score;
  }
  return personalBests;
});

export const getCommunityTabData = cache(async (userId: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    throw new Error("Not authenticated");
  }

  const activityDate = await getUserActivityDate();
  const currentWeekStart = getCurrentWeekStart(activityDate);

  const [access, friendsData, leaderboard, eventsResult, forumPosts, forumOnboarding] =
    await Promise.all([
      getCachedCourseAccess(supabase, user),
      loadFriendsProfileData(supabase, userId),
      loadLeaderboard(supabase, currentWeekStart, userId),
      supabase.from("events").select("*").order("starts_at", { ascending: true }),
      loadForumPostPreviews(supabase, userId, 2),
      loadForumOnboardingState(supabase, userId),
    ]);

  const { upcoming } = splitExpandedEvents((eventsResult.data ?? []) as StoredEvent[]);
  const preparedUpcoming = prepareCommunityEvents(upcoming, access);

  return {
    friendsData,
    leaderboard,
    preparedUpcoming,
    forumPosts,
    forumOnboarding,
  };
});

export const getTutorDashboardData = cache(async (userId: string) => {
  const supabase = await createClient();
  return loadTutorDashboard(supabase, userId);
});
