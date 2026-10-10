"use client";

import {
  acknowledgeCohortWeekGaps,
  dismissDuplicateCohortLessonLog,
  fetchCohortOpsIssueList,
  renumberCohortClassSessionsByDate,
  setCohortSessionWeekNumber,
} from "@/app/admin/cohort-ops/actions";
import {
  distinctCohortCount,
  type CohortOpsIssue,
  type CohortWeekSequenceRow,
} from "@/lib/admin/dashboard/cohort-ops-issues";
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [renumberCohort, setRenumberCohort] = useState<{
    cohortId: string;
    cohortName: string;
    rows: CohortWeekSequenceRow[];
  } | null>(null);

  async function load() {
    const result = await fetchCohortOpsIssueList(kind);
    setIssues(result.issues);
    setError(result.error ?? null);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      const result = await fetchCohortOpsIssueList(kind);
      if (cancelled) return;
      setIssues(result.issues);
      setError(result.error ?? null);
      setLoading(false);
    }

    void initialLoad();

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void initialLoad();
    }

    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [kind]);

  async function runAction(key: string, action: () => Promise<{ error?: string; success?: string }>) {
    setActionError(null);
    setPendingKey(key);
    const result = await action();
    setPendingKey(null);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    await load();
  }

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
      <Link href="/admin" className="text-sm font-medium text-violet-600 hover:text-violet-500">
        ← Operations
      </Link>

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {actionError ? <p className="mb-4 text-sm text-red-600">{actionError}</p> : null}

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
                    <li key={`${issue.issueCode}-${issue.sessionId ?? index}`} className="py-3 first:pt-0">
                      <div className="flex items-start justify-between gap-3">
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
                      </div>

                      {issue.weekRows && issue.weekRows.length > 0 ? (
                        <WeekNumberEditor
                          key={issue.issueLabel}
                          cohortId={group.cohortId}
                          cohortName={group.cohortName}
                          rows={issue.weekRows}
                          gapKeys={issue.gapKeys ?? []}
                          pendingKey={pendingKey}
                          onSave={(sessionId, weekNumber) =>
                            runAction(`week:${sessionId}`, () =>
                              setCohortSessionWeekNumber(sessionId, weekNumber)
                            )
                          }
                          onAcknowledge={() =>
                            runAction(`gaps:${group.cohortId}`, () =>
                              acknowledgeCohortWeekGaps(group.cohortId)
                            )
                          }
                          onRenumber={() =>
                            setRenumberCohort({
                              cohortId: group.cohortId,
                              cohortName: group.cohortName,
                              rows: issue.weekRows ?? [],
                            })
                          }
                        />
                      ) : null}

                      {issue.duplicateEntries && issue.duplicateEntries.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {issue.duplicateEntries.map((entry) => (
                            <li
                              key={entry.entryId}
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700"
                            >
                              <p className="font-medium text-zinc-900">
                                {entry.title?.trim() || "Untitled log"}
                              </p>
                              <p className="mt-1">
                                Status {entry.status ?? "blank"} · {entry.lessonLabel ?? "Not linked"} ·{" "}
                                Recording {entry.hasRecording ? "yes" : "no"} · Source{" "}
                                {entry.source ?? "unknown"}
                              </p>
                              {entry.notionUrl ? (
                                <a
                                  href={entry.notionUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-block font-medium text-violet-700 hover:text-violet-600"
                                >
                                  Open Notion page
                                </a>
                              ) : null}
                              <div className="mt-2">
                                <button
                                  type="button"
                                  disabled={pendingKey === `dismiss:${entry.entryId}`}
                                  onClick={() =>
                                    void runAction(`dismiss:${entry.entryId}`, () =>
                                      dismissDuplicateCohortLessonLog(entry.entryId)
                                    )
                                  }
                                  className="rounded-full border border-zinc-300 px-3 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                                >
                                  {pendingKey === `dismiss:${entry.entryId}`
                                    ? "Dismissing…"
                                    : "Dismiss duplicate"}
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {renumberCohort ? (
        <RenumberDialog
          cohortName={renumberCohort.cohortName}
          rows={renumberCohort.rows}
          pending={pendingKey === `renumber:${renumberCohort.cohortId}`}
          onClose={() => setRenumberCohort(null)}
          onConfirm={() => {
            const cohortId = renumberCohort.cohortId;
            void runAction(`renumber:${cohortId}`, () =>
              renumberCohortClassSessionsByDate(cohortId)
            ).then(() => setRenumberCohort(null));
          }}
        />
      ) : null}
    </div>
  );
}

function WeekNumberEditor({
  cohortId,
  cohortName,
  rows,
  gapKeys,
  pendingKey,
  onSave,
  onAcknowledge,
  onRenumber,
}: {
  cohortId: string;
  cohortName: string;
  rows: CohortWeekSequenceRow[];
  gapKeys: string[];
  pendingKey: string | null;
  onSave: (sessionId: string, weekNumber: string) => Promise<void>;
  onAcknowledge: () => Promise<void>;
  onRenumber: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.sessionId, row.weekNumber?.toString() ?? ""]))
  );

  return (
    <div className="mt-3 space-y-2">
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.sessionId} className="flex flex-wrap items-center gap-2 text-xs text-zinc-700">
            <span className="w-28 shrink-0">
              {row.dateLabel}={row.weekLabel}
            </span>
            <label className="sr-only" htmlFor={`week-${row.sessionId}`}>
              Week number for {cohortName} on {row.dateLabel}
            </label>
            <input
              id={`week-${row.sessionId}`}
              inputMode="numeric"
              value={drafts[row.sessionId] ?? ""}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [row.sessionId]: event.target.value }))
              }
              className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-xs"
            />
            <button
              type="button"
              disabled={pendingKey === `week:${row.sessionId}`}
              onClick={() => void onSave(row.sessionId, drafts[row.sessionId] ?? "")}
              className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {pendingKey === `week:${row.sessionId}` ? "Saving…" : "Set week"}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onRenumber}
          className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
        >
          Renumber by date
        </button>
        {gapKeys.length > 0 ? (
          <button
            type="button"
            disabled={pendingKey === `gaps:${cohortId}`}
            onClick={() => void onAcknowledge()}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {pendingKey === `gaps:${cohortId}` ? "Saving…" : "Mark as intentional"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RenumberDialog({
  cohortName,
  rows,
  pending,
  onClose,
  onConfirm,
}: {
  cohortName: string;
  rows: CohortWeekSequenceRow[];
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const changes = rows.filter((row) => row.weekNumber !== row.renumberedWeek);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="renumber-title"
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="renumber-title" className="text-lg font-semibold text-zinc-900">
          Renumber {cohortName} by date
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Class sessions get week 1, 2, 3… in date order. Nothing is deleted.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-zinc-800">
          {rows.map((row) => (
            <li key={row.sessionId}>
              {row.dateLabel}: {row.weekLabel} → W{row.renumberedWeek}
            </li>
          ))}
        </ul>
        {changes.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">These classes are already numbered by date.</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || changes.length === 0}
            onClick={onConfirm}
            className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {pending ? "Renumbering…" : "Renumber by date"}
          </button>
        </div>
      </div>
    </div>
  );
}
