"use client";

import { useState, useTransition } from "react";
import { castForumPollVote } from "@/app/dashboard/community/forum/actions";
import { ForumRulesSheet } from "@/components/forum/forum-rules-sheet";
import type { ForumPollView } from "@/lib/forum/types";

export function ForumPollCard({ poll }: { poll: ForumPollView }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pendingOption, setPendingOption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showResults = poll.closed || poll.viewerOptionIds.length > 0;

  function vote(optionId: string) {
    setError(null);
    setPendingOption(optionId);
    startTransition(async () => {
      const result = await castForumPollVote(poll.id, optionId);
      if (result.needsRules) {
        setRulesOpen(true);
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
      <p className="text-sm font-semibold text-zinc-900">{poll.question}</p>
      <div className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const selected = poll.viewerOptionIds.includes(option.id);
          const percent = poll.totalVotes === 0 ? 0 : Math.round((option.votes / poll.totalVotes) * 100);
          if (!showResults) {
            return (
              <button
                key={option.id}
                type="button"
                disabled={pending || poll.closed}
                onClick={() => vote(option.id)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm text-zinc-800 hover:border-violet-300"
              >
                {option.label}
              </button>
            );
          }
          return (
            <button
              key={option.id}
              type="button"
              disabled={pending || poll.closed}
              onClick={() => vote(option.id)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm ${
                selected ? "border-violet-400" : "border-zinc-200"
              }`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-violet-200/70"
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex justify-between gap-3">
                <span>{option.label}</span>
                <span>{percent}%</span>
              </span>
            </button>
          );
        })}
      </div>
      {showResults ? (
        <p className="mt-2 text-xs text-zinc-500">
          {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"}
          {poll.closed ? " · Closed" : ""}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ForumRulesSheet
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        onAgreed={() => {
          setRulesOpen(false);
          if (pendingOption) vote(pendingOption);
        }}
      />
    </div>
  );
}
