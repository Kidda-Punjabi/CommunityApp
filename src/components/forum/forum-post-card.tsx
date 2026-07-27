"use client";

import Link from "next/link";
import { ForumCategoryBadge } from "@/components/forum/forum-category-badge";
import { ForumLikeButton } from "@/components/forum/forum-like-button";
import { StaffRoleBadge } from "@/components/forum/staff-role-badge";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { ForumPostSummary } from "@/lib/forum/types";
import { ForumEditedLabel } from "@/components/forum/forum-edited-label";
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
  const bodySnippet = post.bodySnippet;
  return (
    <article className={ui.cardBordered}>
      <Link
        href={`/dashboard/community/forum/${post.id}`}
        className="block transition-colors hover:bg-violet-50/30"
      >
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
              <ForumEditedLabel editedAt={post.editedAt} />
            </div>
            <h3 className="mt-1 font-heading text-base font-semibold text-zinc-900">{post.title}</h3>
            {post.category ? (
              <span className="mt-2 inline-block">
                <ForumCategoryBadge category={post.category} />
              </span>
            ) : null}
            {bodySnippet ? (
              <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{bodySnippet}</p>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
        <span className="text-xs text-zinc-500">
          {post.replyCount} repl{post.replyCount === 1 ? "y" : "ies"}
        </span>
        <ForumLikeButton
          targetType="post"
          targetId={post.id}
          postId={post.id}
          initialLiked={post.likedByViewer}
          initialCount={post.likeCount}
          size="sm"
        />
      </div>
    </article>
  );
}
