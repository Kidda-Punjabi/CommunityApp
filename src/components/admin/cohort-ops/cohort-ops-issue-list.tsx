"use client";

import { fetchCohortOpsIssueList } from "@/app/admin/cohort-ops/actions";
import { distinctCohortCount, type CohortOpsIssue } from "@/lib/admin/dashboard/cohort-ops-issues";
import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useEffect, useState } from "react";

type CohortOpsIssueListProps = {
  kind: "setup" | "integrity";
  title: string;
  description: string;
};

function formatStart(iso: string | null): string {
  if (!iso) return "No start date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No start date";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
}

export function CohortOpsIssueList({ kind, title, description }: CohortOpsIssueListProps) {
  const [issues, setIssues] = useState<CohortOpsIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await fetchCohortOpsIssueList(kind);
      if (cancelled) return;
      setIssues(result.issues);
      setError(result.error ?? null);
      setLoading(false);
    }

    void load();

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void load();
    }

    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [kind]);

  const groups: Array<{
    cohortId: string;
    cohortName: string;
    tutorName: string | null;
    startDate: string | null;
    issues: CohortOpsIssue[];
  }> = [];
  const indexByCohort = new Map<string, number>();
  for (const issue of issues) {
    const existing = indexByCohort.get(issue.cohortId);
    if (existing == null) {
      indexByCohort.set(issue.cohortId, groups.length);
      groups.push({
        cohortId: issue.cohortId,
        cohortName: issue.cohortName,
        tutorName: issue.tutorName,
        startDate: issue.startDate,
        issues: [issue],
      });
    } else {
      groups[existing]!.issues.push(issue);
    }
  }

  const cohortCount = distinctCohortCount(issues);

  return (
    <div className={ui.page}>
      <Link
        href="/admin"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Operations
      </Link>

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? null : cohortCount === 0 ? (
        <div className="rounded-[12px] border-[0.5px] border-zinc-200 bg-white px-4 py-12 text-center">
          <p className="text-sm font-medium text-zinc-900">All cohorts are set up correctly.</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-600">
            {cohortCount} {cohortCount === 1 ? "cohort" : "cohorts"}
          </p>
          <ul className="space-y-3">
            {groups.map((group) => (
              <li
                key={group.cohortId}
                className="rounded-[12px] border-[0.5px] border-zinc-200 bg-white px-4 py-4"
              >
                <h2 className="text-base font-semibold text-zinc-900">{group.cohortName}</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {group.tutorName ?? "No tutor"} · Starts {formatStart(group.startDate)}
                </p>
                <ul className="mt-3 divide-y divide-zinc-100">
                  {group.issues.map((issue, index) => (
                    <li
                      key={`${issue.issueCode}-${issue.sessionId ?? index}`}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-900">{issue.issueLabel}</p>
                        {issue.sessionId ? (
                          <p className="mt-1 break-all font-mono text-[11px] text-zinc-500">
                            Session {issue.sessionId}
                          </p>
                        ) : null}
                        {issue.fixInstruction ? (
                          <p className="mt-1 text-xs leading-snug text-zinc-500">
                            {issue.fixInstruction}
                          </p>
                        ) : null}
                      </div>
                      {issue.fixUrl ? (
                        <Link
                          href={issue.fixUrl}
                          className="shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
                        >
                          Fix
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
