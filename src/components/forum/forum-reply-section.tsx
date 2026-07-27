"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createForumReply,
  type ForumActionResult,
} from "@/app/dashboard/community/forum/actions";
import { ForumLikeButton } from "@/components/forum/forum-like-button";
import { ForumReportDialog } from "@/components/forum/forum-report-dialog";
import { StaffRoleBadge } from "@/components/forum/staff-role-badge";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { ForumReply } from "@/lib/forum/types";

const initial: ForumActionResult = {};

/** Visual indent caps at this depth; deeper nesting stays at max padding. */
export const FORUM_REPLY_MAX_VISUAL_DEPTH = 4;

function formatForumDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type ForumReplyThreadProps = {
  replies: ForumReply[];
  postId: string;
  canReply: boolean;
  depth?: number;
};

export function ForumReplyThread({
  replies,
  postId,
  canReply,
  depth = 0,
}: ForumReplyThreadProps) {
  return (
    <div className={depth === 0 ? "space-y-3" : "mt-3 space-y-3 border-l-2 border-violet-100 pl-3 sm:pl-4"}>
      {replies.map((reply) => (
        <ForumReplyItem
          key={reply.id}
          reply={reply}
          postId={postId}
          canReply={canReply}
          depth={depth}
        />
      ))}
    </div>
  );
}

type ForumReplyItemProps = {
  reply: ForumReply;
  postId: string;
  canReply: boolean;
  depth: number;
};

function ForumReplyItem({ reply, postId, canReply, depth }: ForumReplyItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const visualDepth = Math.min(depth, FORUM_REPLY_MAX_VISUAL_DEPTH);

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
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <ForumLikeButton
              targetType="reply"
              targetId={reply.id}
              postId={postId}
              initialLiked={reply.likedByViewer}
              initialCount={reply.likeCount}
              size="sm"
            />
            <ForumReportDialog targetType="reply" targetId={reply.id} />
            {canReply ? (
              <button
                type="button"
                onClick={() => setShowReplyForm((open) => !open)}
                className="text-xs font-medium text-violet-700 hover:text-violet-500"
              >
                {showReplyForm ? "Cancel" : "Reply"}
              </button>
            ) : null}
          </div>
          {showReplyForm && canReply ? (
            <div className="mt-3">
              <ForumReplyForm
                postId={postId}
                parentReplyId={reply.id}
                onPosted={() => setShowReplyForm(false)}
                compact
              />
            </div>
          ) : null}
          {reply.children.length > 0 ? (
            <ForumReplyThread
              replies={reply.children}
              postId={postId}
              canReply={canReply}
              depth={visualDepth + 1}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

type ForumReplyFormProps = {
  postId: string;
  parentReplyId?: string | null;
  onPosted?: () => void;
  compact?: boolean;
};

export function ForumReplyForm({
  postId,
  parentReplyId = null,
  onPosted,
  compact = false,
}: ForumReplyFormProps) {
  const boundAction = createForumReply.bind(null, postId, parentReplyId);
  const [state, formAction, pending] = useActionState(boundAction, initial);

  useEffect(() => {
    if (state.success && onPosted) onPosted();
  }, [state.success, onPosted]);

  return (
    <form
      action={formAction}
      className={
        compact
          ? "space-y-2 rounded-xl border border-zinc-200 bg-white p-3"
          : "space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
      }
    >
      {!compact ? (
        <h3 className="font-heading text-base font-semibold text-zinc-900">Add a reply</h3>
      ) : null}
      <textarea
        name="body"
        required
        rows={compact ? 3 : 4}
        placeholder={parentReplyId ? "Write your reply…" : "Share your thoughts or answer…"}
        className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />
      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success && !onPosted ? (
        <p className="text-sm text-emerald-600" role="status">
          {state.success}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post reply"}
      </button>
    </form>
  );
}
