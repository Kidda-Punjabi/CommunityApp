"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createForumPost,
  type ForumActionResult,
} from "@/app/dashboard/community/forum/actions";
import { ForumRulesSheet } from "@/components/forum/forum-rules-sheet";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

const initial: ForumActionResult = {};

export function NewForumPostForm() {
  const [state, formAction, pending] = useActionState(createForumPost, initial);
  const [pollOn, setPollOn] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.needsRules) setRulesOpen(true);
  }, [state.needsRules]);

  return (
    <form ref={formRef} action={formAction} className={`${ui.cardBordered} space-y-4`}>
      <div>
        <label htmlFor="forum-title" className="block text-sm font-medium text-zinc-700">
          Title
        </label>
        <input
          id="forum-title"
          name="title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
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
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="poll_enabled"
          checked={pollOn}
          onChange={(event) => setPollOn(event.target.checked)}
        />
        Add poll
      </label>
      {pollOn ? (
        <div className="space-y-3 rounded-2xl border border-zinc-200 p-4">
          <input
            name="poll_question"
            required
            placeholder="Poll question"
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
          />
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <input
              key={index}
              name={`poll_option_${index}`}
              required={index <= 2}
              placeholder={`Option ${index}${index <= 2 ? "" : " (optional)"}`}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
            />
          ))}
          <label className="block text-sm text-zinc-600">
            Closes
            <input type="datetime-local" name="poll_closes_at" className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="poll_allow_multiple" />
            Allow multiple choices
          </label>
        </div>
      ) : null}

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
      <ForumRulesSheet
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        onAgreed={() => {
          setRulesOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
