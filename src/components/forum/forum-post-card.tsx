import Link from "next/link";
import { UserAvatar } from "@/components/profile/user-avatar";
import { StaffRoleBadge } from "@/components/forum/staff-role-badge";
import type { ForumPostSummary } from "@/lib/forum/types";
import { ui } from "@/lib/ui/styles";

function formatForumDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

type ForumPostCardProps = {
  post: ForumPostSummary;
};

export function ForumPostCard({ post }: ForumPostCardProps) {
  return (
    <Link href={`/dashboard/community/forum/${post.id}`} className={ui.cardInteractive}>
      <div className="flex items-start gap-3">
        <UserAvatar
          profile={{
            full_name: post.author.displayName,
            preferred_name: post.author.displayName,
            avatar_url: post.author.avatarUrl,
          }}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-900">{post.author.displayName}</span>
            <StaffRoleBadge roles={post.author.staffRoles} />
            <span className="text-xs text-zinc-400">{formatForumDate(post.createdAt)}</span>
          </div>
          <h3 className="mt-1 font-heading text-base font-semibold text-zinc-900">{post.title}</h3>
          {post.category && (
            <span className="mt-2 inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              {post.category}
            </span>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
            <span>{post.replyCount} repl{post.replyCount === 1 ? "y" : "ies"}</span>
            <span>{post.likeCount} like{post.likeCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
