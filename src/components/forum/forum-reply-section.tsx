"use client";

import { useActionState } from "react";
import {
  createForumReply,
  type ForumActionResult,
} from "@/app/dashboard/community/forum/actions";
import { ForumLikeButton } from "@/components/forum/forum-like-button";
import { ForumReportDialog } from "@/components/forum/forum-report-dialog";
import { StaffRoleBadge } from "@/components/forum/staff-role-badge";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { ForumReply } from "@/lib/forum/types";
import { ui } from "@/lib/ui/styles";

const initial: ForumActionResult = {};

function formatForumDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type ForumReplyItemProps = {
  reply: ForumReply;
  postId: string;
};

export function ForumReplyItem({ reply, postId }: ForumReplyItemProps) {
  return (
    <article className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
      <div className="flex items-start gap-3">
        <UserAvatar
          profile={{
            full_name: reply.author.displayName,
            preferred_name: reply.author.displayName,
            avatar_url: reply.author.avatarUrl,
          }}
          size="xs"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-900">{reply.author.displayName}</span>
            <StaffRoleBadge roles={reply.author.staffRoles} />
            <span className="text-xs text-zinc-400">{formatForumDate(reply.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{reply.body}</p>
          <div className="mt-3 flex items-center gap-4">
            <ForumLikeButton
              targetType="reply"
              targetId={reply.id}
              postId={postId}
              initialLiked={reply.likedByViewer}
              initialCount={reply.likeCount}
              size="sm"
            />
            <ForumReportDialog targetType="reply" targetId={reply.id} />
          </div>
        </div>
      </div>
    </article>
  );
}

type ForumReplyFormProps = {
  postId: string;
};

export function ForumReplyForm({ postId }: ForumReplyFormProps) {
  const boundAction = createForumReply.bind(null, postId);
  const [state, formAction, pending] = useActionState(boundAction, initial);

  return (
    <form action={formAction} className={`${ui.cardBordered} space-y-3`}>
      <h3 className="font-heading text-base font-semibold text-zinc-900">Add a reply</h3>
      <textarea
        name="body"
        required
        rows={4}
        placeholder="Share your thoughts or answer…"
        className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-emerald-600" role="status">
          {state.success}
        </p>
      )}
      <button type="submit" disabled={pending} className={ui.btnPrimary}>
        {pending ? "Posting…" : "Post reply"}
      </button>
    </form>
  );
}
