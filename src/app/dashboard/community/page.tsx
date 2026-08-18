import { CommunityCourseEntry } from "@/components/community/community-course-entry";
import { CommunityForumPreviewSection } from "@/components/community/community-forum-preview-section";
import { CommunityFriendsLeaderboardCard } from "@/components/community/community-friends-leaderboard-card";
import { CommunityTutorPicksSection } from "@/components/community/community-tutor-picks-section";
import { NextClassCard } from "@/components/community/next-class-card";
import { PlayTogetherSection } from "@/components/community/play-together-section";
import { HubCard, HubGhostLink } from "@/components/ui/hub-primitives";
import { hasConfirmedCommunityPackage } from "@/lib/community/access";
import { loadTutorPicksForStudent } from "@/lib/community/recommendations";
import { getCommunityTabData } from "@/lib/cache/tab-page-cache";
import { isLearnTrackUnlocked } from "@/lib/learning/learn-access";
import { getLearnTrack } from "@/lib/learning/learn-catalog";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { getCachedCourseAccess } from "@/lib/supabase/cached-session";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { ui } from "@/lib/ui/styles";

export default async function CommunityPage() {
  const { user, supabase } = await requireNoKidCommunityAccess();

  const [
    { friendsData, leaderboard, preparedUpcoming, forumPosts, forumOnboarding },
    access,
    hasCommunityPackage,
    isTutor,
    tutorPickGroups,
  ] = await Promise.all([
    getCommunityTabData(user.id),
    getCachedCourseAccess(supabase, user),
    hasConfirmedCommunityPackage(supabase, user.id),
    canAccessTutorDashboard(supabase, user.id),
    loadTutorPicksForStudent(supabase, user.id),
  ]);

  const nextClass = hasCommunityPackage ? (preparedUpcoming[0] ?? null) : null;

  const communityTrack = getLearnTrack("community")!;
  const showCommunityCourse = isLearnTrackUnlocked(communityTrack, access);

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Community</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Forum, live classes, games, and friends learning with you.
        </p>
      </div>

      <div className={ui.stack}>
        {showCommunityCourse ? <CommunityCourseEntry /> : null}

        <CommunityForumPreviewSection posts={forumPosts} onboarding={forumOnboarding} />

        {isTutor ? (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-zinc-900">My favorites</h2>
              <HubGhostLink href="/dashboard/community/favorites">Manage picks</HubGhostLink>
            </div>
            <HubCard className="py-4">
              <p className="text-sm text-zinc-600">
                Choose movies, books, and recipes for your students to see here.
              </p>
            </HubCard>
          </section>
        ) : null}

        <CommunityTutorPicksSection groups={tutorPickGroups} compact />

        {nextClass ? <NextClassCard prepared={nextClass} /> : null}

        <PlayTogetherSection />

        <CommunityFriendsLeaderboardCard
          friends={friendsData.friends}
          leaderboard={leaderboard}
        />
      </div>
    </div>
  );
}
