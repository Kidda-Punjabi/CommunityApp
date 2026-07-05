"use client";

import { useTransition } from "react";
import { moderateForumContent } from "@/app/dashboard/community/forum/actions";
import type { ForumReportRow } from "@/lib/forum/types";
import { ui } from "@/lib/ui/styles";

function formatForumDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type ForumModerationTabProps = {
  reports: ForumReportRow[];
};

export function ForumModerationTab({ reports }: ForumModerationTabProps) {
  const [pending, startTransition] = useTransition();

  function handleModerate(
    targetType: "post" | "reply",
    targetId: string,
    action: "hide" | "remove"
  ) {
    startTransition(async () => {
      await moderateForumContent(targetType, targetId, action);
    });
  }

  return (
    <div className="max-w-3xl rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Forum moderation</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Open reports from members. Hiding removes content from the member-facing forum.
      </p>

      {reports.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No open reports — all clear.</p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-100">
          {reports.map((report) => (
            <li key={report.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {report.targetType} · {formatForumDate(report.createdAt)}
                  </p>
                  <p className="mt-1 font-medium text-zinc-900">{report.targetPreview}</p>
                  <p className="mt-2 text-sm text-zinc-600">
                    <span className="font-medium">Reason:</span> {report.reason}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Reported by {report.reporterName}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      handleModerate(report.targetType, report.targetId, "hide")
                    }
                    className={ui.btnSecondary}
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      handleModerate(report.targetType, report.targetId, "remove")
                    }
                    className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
