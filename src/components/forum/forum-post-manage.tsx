"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  deleteForumPost,
  updateForumPost,
  type ForumActionResult,
} from "@/app/dashboard/community/forum/actions";
import type { ForumPostDetail } from "@/lib/forum/types";
import { ui } from "@/lib/ui/styles";

const initial: ForumActionResult = {};

type ForumPostManageProps = {
  post: ForumPostDetail;
  viewerUserId: string;
  isMasterAdmin: boolean;
};

export function ForumPostManage({ post, viewerUserId, isMasterAdmin }: ForumPostManageProps) {
  const isAuthor = post.author.id === viewerUserId;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isMasterAdmin;

  const [editing, setEditing] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const boundUpdate = updateForumPost.bind(null, post.id);
  const [state, formAction, pending] = useActionState(boundUpdate, initial);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  if (!canEdit && !canDelete) return null;

  function handleDelete() {
    const label = isAuthor ? "your post" : "this post";
    if (!window.confirm(`Delete ${label}? This cannot be undone from the forum.`)) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteForumPost(post.id);
      if (result?.error) setDeleteError(result.error);
    });
  }

  if (editing && canEdit) {
    return (
      <form action={formAction} className="mt-4 space-y-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <h2 className="font-heading text-base font-semibold text-zinc-900">Edit post</h2>
        <input
          name="title"
          required
          defaultValue={post.title}
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
        />
        <textarea
          name="body"
          required
          rows={6}
          defaultValue={post.body}
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900"
        />
        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-emerald-600" role="status">
            {state.success}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={ui.btnPrimary}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(false)}
            className={ui.btnSecondary}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Edit
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          disabled={deletePending}
          onClick={handleDelete}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
        >
          {deletePending ? "Deleting…" : "Delete"}
        </button>
      ) : null}
      {deleteError ? (
        <p className="w-full text-sm text-red-600" role="alert">
          {deleteError}
        </p>
      ) : null}
    </div>
  );
}
