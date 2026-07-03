import { SummaryRow } from "@/components/ui/hub-primitives";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { FriendListItem } from "@/lib/friends/load-friends";

type FriendsSummaryRowProps = {
  friends: FriendListItem[];
  variant?: "profile" | "community";
};

export function FriendsSummaryRow({ friends, variant = "profile" }: FriendsSummaryRowProps) {
  const preview = friends.slice(0, 3);
  const countLabel =
    variant === "community"
      ? friends.length === 0
        ? "Invite friends · invite more"
        : friends.length === 1
          ? "1 friend · invite more"
          : `${friends.length} friends · invite more`
      : friends.length === 1
        ? "1 friend learning with you"
        : `${friends.length} friends learning with you`;

  return (
    <SummaryRow href="/dashboard/profile/friends" title="Friends">
      <div className="flex items-center gap-2">
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
                size="sm"
                className="ring-2 ring-white"
              />
            ))}
          </div>
        ) : null}
        <p className="text-sm text-zinc-500">
          {friends.length === 0 && variant === "profile"
            ? "Invite friends to learn together"
            : countLabel}
        </p>
      </div>
    </SummaryRow>
  );
}
