import { CommunityCourseEntry } from "@/components/community/community-course-entry";
import { CommunityForumPreviewSection } from "@/components/community/community-forum-preview-section";
import { CommunityFriendsLeaderboardCard } from "@/components/community/community-friends-leaderboard-card";
import { NextClassCard } from "@/components/community/next-class-card";
import { PlayTogetherSection } from "@/components/community/play-together-section";
import { hasConfirmedCommunityPackage } from "@/lib/community/access";
import { getCommunityTabData } from "@/lib/cache/tab-page-cache";
import { isLearnTrackUnlocked } from "@/lib/learning/learn-access";
import { getLearnTrack } from "@/lib/learning/learn-catalog";
import { loadKidSession } from "@/lib/kids/session";
import {
  getCachedAuthSession,
  getCachedCourseAccess,
} from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function CommunityPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const [
    { friendsData, leaderboard, preparedUpcoming, forumPosts, forumOnboarding },
    access,
    hasCommunityPackage,
  ] = await Promise.all([
    getCommunityTabData(session.user.id),
    getCachedCourseAccess(session.supabase, session.user),
    hasConfirmedCommunityPackage(session.supabase, session.user.id),
  ]);

  const kidSession = await loadKidSession(session.user.id);
  const hideForum = kidSession.activeKidProfile !== null;
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

        {!hideForum && (
          <CommunityForumPreviewSection posts={forumPosts} onboarding={forumOnboarding} />
        )}

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
