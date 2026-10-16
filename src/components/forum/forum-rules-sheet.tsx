"use client";

import { useState, useTransition } from "react";
import { acceptForumRules } from "@/app/dashboard/community/forum/actions";
import { FORUM_RULES } from "@/lib/forum/safety";

type ForumRulesSheetProps = {
  open: boolean;
  onClose: () => void;
  onAgreed: () => void;
};

export function ForumRulesSheet({ open, onClose, onAgreed }: ForumRulesSheetProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function agree() {
    setError(null);
    startTransition(async () => {
      const result = await acceptForumRules();
      if (result.error) {
        setError(result.error);
        return;
      }
      onAgreed();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="forum-rules-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
      >
        <h2 id="forum-rules-title" className="font-heading text-lg font-semibold text-zinc-900">
          Community rules
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          {FORUM_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={agree}
            disabled={pending}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "I agree"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
