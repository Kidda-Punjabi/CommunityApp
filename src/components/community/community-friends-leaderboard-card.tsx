import Link from "next/link";
import { UserAvatar } from "@/components/profile/user-avatar";
import { EyebrowLabel, HubCard, HubGhostLink } from "@/components/ui/hub-primitives";
import type { FriendListItem } from "@/lib/friends/load-friends";
import type { LeaderboardData } from "@/lib/leaderboard/load-leaderboard";
import { formatWeekRangeLabel } from "@/lib/leaderboard/week";

type CommunityFriendsLeaderboardCardProps = {
  friends: FriendListItem[];
  leaderboard: LeaderboardData;
};

export function CommunityFriendsLeaderboardCard({
  friends,
  leaderboard,
}: CommunityFriendsLeaderboardCardProps) {
  const preview = friends.slice(0, 3);
  const viewer = leaderboard.viewerRow;
  const friendsLabel =
    friends.length === 0
      ? "No friends yet"
      : friends.length === 1
        ? "1 friend"
        : `${friends.length} friends`;

  return (
    <HubCard className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <EyebrowLabel>Friends</EyebrowLabel>
          <div className="mt-1 flex items-center gap-2">
            {preview.length > 0 ? (
              <div className="flex -space-x-2">
                {preview.map((friend) => (
                  <UserAvatar
                    key={friend.userId}
                    profile={{
                      full_name: friend.displayName,
                      preferred_name: null,
                      avatar_url: friend.avatarUrl,
                    }}
                    size="xs"
                    className="ring-2 ring-white"
                  />
                ))}
              </div>
            ) : null}
            <p className="text-sm text-zinc-700">{friendsLabel}</p>
          </div>
        </div>
        <HubGhostLink href="/dashboard/profile/friends">Invite more</HubGhostLink>
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <EyebrowLabel>Weekly leaderboard</EyebrowLabel>
            <p className="mt-1 text-sm text-zinc-500">{formatWeekRangeLabel(leaderboard.weekStart)}</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">
              {viewer.rank != null ? `#${viewer.rank}` : "Unranked"} · {viewer.points} pts
            </p>
          </div>
          <HubGhostLink href="/dashboard/leaderboard" className="shrink-0">
            View full leaderboard
          </HubGhostLink>
        </div>
      </div>
    </HubCard>
  );
}
