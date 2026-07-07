"use client";

import { useActionState } from "react";
import {
  createForumIntroPost,
  type ForumActionResult,
} from "@/app/dashboard/community/forum/actions";
import { ui } from "@/lib/ui/styles";

const initial: ForumActionResult = {};

export function ForumIntroPostForm() {
  const [state, formAction, pending] = useActionState(createForumIntroPost, initial);

  return (
    <form action={formAction} className={`${ui.cardBordered} space-y-4`}>
      <div>
        <p className="text-sm text-zinc-600">
          Welcome to the community! Before you join discussions, say hello so other members can
          get to know you.
        </p>
        <label htmlFor="intro-body" className="mt-4 block text-sm font-medium text-zinc-700">
          Your introduction
        </label>
        <textarea
          id="intro-body"
          name="body"
          required
          rows={8}
          placeholder="Introduce yourself — share your name, why you joined Kidda, and a fun fact about you."
          className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={ui.btnPrimary}>
        {pending ? "Posting…" : "Post introduction"}
      </button>
    </form>
  );
}
