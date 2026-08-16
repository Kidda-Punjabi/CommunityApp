import { CommunityCourseEntry } from "@/components/community/community-course-entry";
import { CommunityForumPreviewSection } from "@/components/community/community-forum-preview-section";
import { CommunityFriendsLeaderboardCard } from "@/components/community/community-friends-leaderboard-card";
import { NextClassCard } from "@/components/community/next-class-card";
import { PlayTogetherSection } from "@/components/community/play-together-section";
import { hasConfirmedCommunityPackage } from "@/lib/community/access";
import { getCommunityTabData } from "@/lib/cache/tab-page-cache";
import { isLearnTrackUnlocked } from "@/lib/learning/learn-access";
import { getLearnTrack } from "@/lib/learning/learn-catalog";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { getCachedCourseAccess } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";

export default async function CommunityPage() {
  const { user, supabase } = await requireNoKidCommunityAccess();

  const [
    { friendsData, leaderboard, preparedUpcoming, forumPosts, forumOnboarding },
    access,
    hasCommunityPackage,
  ] = await Promise.all([
    getCommunityTabData(user.id),
    getCachedCourseAccess(supabase, user),
    hasConfirmedCommunityPackage(supabase, user.id),
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
