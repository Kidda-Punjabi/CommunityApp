"use client";

import { useActionState } from "react";
import {
  createForumPost,
  type ForumActionResult,
} from "@/app/dashboard/community/forum/actions";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

const initial: ForumActionResult = {};

export function NewForumPostForm() {
  const [state, formAction, pending] = useActionState(createForumPost, initial);

  return (
    <form action={formAction} className={`${ui.cardBordered} space-y-4`}>
      <div>
        <label htmlFor="forum-title" className="block text-sm font-medium text-zinc-700">
          Title
        </label>
        <input
          id="forum-title"
          name="title"
          required
          maxLength={200}
          className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      <div>
        <label htmlFor="forum-category" className="block text-sm font-medium text-zinc-700">
          Category <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <input
          id="forum-category"
          name="category"
          maxLength={80}
          placeholder="e.g. Grammar, Culture, Homework help"
          className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      <div>
        <label htmlFor="forum-body" className="block text-sm font-medium text-zinc-700">
          Message
        </label>
        <textarea
          id="forum-body"
          name="body"
          required
          rows={8}
          className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-emerald-600" role="status">
          {state.success}{" "}
          <Link href="/dashboard/community/forum" className="font-medium underline">
            View forum
          </Link>
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={ui.btnPrimary}>
          {pending ? "Publishing…" : "Publish post"}
        </button>
        <Link href="/dashboard/community/forum" className={ui.btnGhost}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
