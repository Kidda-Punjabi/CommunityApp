"use client";

import { useState, useTransition } from "react";
import { moderateForumItem } from "@/app/admin/forum-moderation/actions";
import Link from "next/link";

type Props = {
  targetType: "post" | "reply";
  targetId: string;
  authorId: string;
};

export function ForumModerationActions({ targetType, targetId, authorId }: Props) {
  const [reason, setReason] = useState("");
  const [span, setSpan] = useState<"7" | "30" | "permanent">("7");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: "dismiss" | "remove" | "suspend") {
    setError(null);
    startTransition(async () => {
      const result = await moderateForumItem({
        targetType,
        targetId,
        action,
        suspendFor: action === "suspend" ? span : null,
        reason,
      });
      if (result.error) setError(result.error);
      else window.location.reload();
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run("dismiss")} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm">
          Dismiss
        </button>
        <button type="button" disabled={pending} onClick={() => run("remove")} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700">
          Remove
        </button>
        <Link href={`/admin/forum-moderation/author/${authorId}`} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm">
          Author history
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={span}
          onChange={(event) => setSpan(event.target.value as "7" | "30" | "permanent")}
          className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
        >
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="permanent">Permanent</option>
        </select>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Suspension reason"
          className="min-w-48 flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
        />
        <button type="button" disabled={pending} onClick={() => run("suspend")} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white">
          Remove and suspend
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
