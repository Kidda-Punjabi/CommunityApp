"use client";

import {
  fetchSyncHealth,
  resolveLeadLinkConflict,
  retryGrantQueueItem,
  retryLessonLogSyncRow,
  type SyncHealthSnapshot,
} from "@/app/admin/sync-health/actions";
import { AdminHubPage } from "@/components/admin/admin-hub-list";
import { cn } from "@/lib/ui/styles";
import { useCallback, useEffect, useState, useTransition } from "react";

const tableWrap = "overflow-x-auto rounded-[12px] border-[0.5px] border-zinc-200 bg-white";
const thClass = "px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400";
const tdClass = "px-4 py-3 text-sm text-zinc-800 align-top";
const btnClass =
  "rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 disabled:opacity-50";

const STEP_LABELS: Record<string, string> = {
  leadsCache: "Leads cache",
  packages: "Package pull",
  lessonLog: "Lessons Log pull",
  salesCalls: "Sales call sync",
  profileLeads: "Unlinked-profile matching",
  groupCohorts: "Group roster rescan",
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const deltaSec = Math.round((Date.now() - then) / 1000);
  const abs = Math.abs(deltaSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(-Math.trunc(deltaSec), "second");
  if (abs < 3600) return rtf.format(-Math.trunc(deltaSec / 60), "minute");
  if (abs < 86400) return rtf.format(-Math.trunc(deltaSec / 3600), "hour");
  return rtf.format(-Math.trunc(deltaSec / 86400), "day");
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function outcomeLabel(outcome: string | undefined, skipped: boolean): string {
  if (skipped) return "Skipped (overlap)";
  if (outcome === "succeeded") return "Succeeded";
  if (outcome === "failed") return "Failed";
  if (outcome === "running") return "Running";
  if (outcome === "skipped_overlap") return "Skipped (overlap)";
  return outcome ?? "Unknown";
}

function outcomeClass(outcome: string | undefined, skipped: boolean): string {
  if (skipped || outcome === "skipped_overlap") return "bg-zinc-100 text-zinc-700";
  if (outcome === "succeeded") return "bg-emerald-50 text-emerald-800";
  if (outcome === "failed") return "bg-red-50 text-red-800";
  return "bg-amber-50 text-amber-900";
}

function stepOk(value: unknown): boolean | null {
  if (!value || typeof value !== "object") return null;
  if ("ok" in value && typeof value.ok === "boolean") return value.ok;
  return null;
}

function stepThrew(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "threw" in value && value.threw);
}

function emptySnapshot(): SyncHealthSnapshot {
  return {
    lastRun: null,
    watermarks: [],
    lock: { held: false, holder: null, acquiredAt: null, expiresAt: null },
    lessonErrors: [],
    failures: [],
    conflicts: [],
    grantQueue: [],
  };
}

export function AdminSyncHealthSection() {
  const [data, setData] = useState<SyncHealthSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const snapshot = await fetchSyncHealth();
    setData(snapshot);
    setError(snapshot.error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function runAction(work: () => Promise<{ error?: string; success?: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (result.error) setError(result.error);
      if (result.success) setMessage(result.success);
      await reload();
    });
  }

  const lastRun = data.lastRun;
  const stepEntries = lastRun
    ? Object.entries(STEP_LABELS).map(([key, label]) => ({
        key,
        label,
        value: lastRun.steps[key],
      }))
    : [];

  return (
    <AdminHubPage
      title="Sync Health"
      description="Live Notion cron status, watermarks, and unresolved sync issues."
    >
      {error ? (
        <p className="mb-4 rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-[12px] border-[0.5px] border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      <div className="mb-6 flex justify-end">
        <button type="button" className={btnClass} disabled={pending || loading} onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Last cron run
        </h2>
        <div className="rounded-[12px] border-[0.5px] border-zinc-200 bg-white px-4 py-4">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : lastRun ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    outcomeClass(lastRun.outcome, lastRun.skippedOverlap)
                  )}
                >
                  {outcomeLabel(lastRun.outcome, lastRun.skippedOverlap)}
                </span>
                <p className="text-sm text-zinc-700">
                  {formatWhen(lastRun.startedAt)} · {formatDuration(lastRun.durationMs)} ·{" "}
                  {timeAgo(lastRun.startedAt)}
                </p>
              </div>
              {lastRun.error ? (
                <p className="mt-2 text-sm text-red-700">{lastRun.error}</p>
              ) : null}
              {data.lock.held ? (
                <p className="mt-2 text-sm text-amber-800">
                  Lock held until {formatWhen(data.lock.expiresAt)} — overlapping runs will skip.
                </p>
              ) : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {stepEntries.map((step) => {
                  const ok = stepOk(step.value);
                  const threw = stepThrew(step.value);
                  return (
                    <div
                      key={step.key}
                      className="rounded-[10px] border border-zinc-100 bg-zinc-50 px-3 py-2.5"
                    >
                      <p className="text-sm font-medium text-zinc-900">{step.label}</p>
                      <p
                        className={cn(
                          "mt-0.5 text-xs font-semibold",
                          threw || ok === false
                            ? "text-red-700"
                            : ok === true
                              ? "text-emerald-700"
                              : "text-zinc-500"
                        )}
                      >
                        {threw ? "Threw" : ok === false ? "Failed" : ok === true ? "OK" : "Not recorded"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">No cron run recorded yet.</p>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Watermark positions
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {data.watermarks.map((mark) => (
            <div
              key={mark.id}
              className="rounded-[12px] border-[0.5px] border-zinc-200 bg-white px-4 py-4"
            >
              <p className="text-sm font-medium text-zinc-900">{mark.label}</p>
              <p className="mt-1 font-mono text-xs text-zinc-600">
                {mark.lastEditedTime ?? "No cursor yet"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Last moved {mark.savedAt ? timeAgo(mark.savedAt) : "unknown (not stamped yet)"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Recent sync errors
        </h2>
        <div className={tableWrap}>
          <table className="min-w-full text-left">
            <thead className="border-b border-zinc-100 bg-zinc-50/80">
              <tr>
                <th className={thClass}>Lesson</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Error</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.lessonErrors.length === 0 ? (
                <tr>
                  <td className={`${tdClass} text-zinc-500`} colSpan={4}>
                    No lesson-log rows with notion_sync_status = error.
                  </td>
                </tr>
              ) : (
                data.lessonErrors.map((row) => (
                  <tr key={row.id}>
                    <td className={tdClass}>
                      <p className="font-medium">{row.title || "Untitled"}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
                        {row.notionPageId ?? row.id}
                      </p>
                    </td>
                    <td className={tdClass}>{row.lessonDate ?? "—"}</td>
                    <td className={tdClass}>
                      <p className="max-w-sm whitespace-pre-wrap text-xs text-zinc-600">
                        {row.error ?? "Unknown error"}
                      </p>
                    </td>
                    <td className={tdClass}>
                      {row.notionPageId ? (
                        <button
                          type="button"
                          className={btnClass}
                          disabled={pending}
                          onClick={() => runAction(() => retryLessonLogSyncRow(row.notionPageId!))}
                        >
                          Retry
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Failed Lessons Log pages (retry queue)
        </h2>
        <div className={tableWrap}>
          <table className="min-w-full text-left">
            <thead className="border-b border-zinc-100 bg-zinc-50/80">
              <tr>
                <th className={thClass}>Notion page</th>
                <th className={thClass}>Retries</th>
                <th className={thClass}>Last failed</th>
                <th className={thClass}>Error</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.failures.length === 0 ? (
                <tr>
                  <td className={`${tdClass} text-zinc-500`} colSpan={5}>
                    No pages waiting to retry.
                  </td>
                </tr>
              ) : (
                data.failures.map((row) => (
                  <tr key={row.notionPageId}>
                    <td className={`${tdClass} font-mono text-xs`}>{row.notionPageId}</td>
                    <td className={tdClass}>{row.retryCount}</td>
                    <td className={tdClass}>{timeAgo(row.lastFailedAt)}</td>
                    <td className={tdClass}>
                      <p className="max-w-sm text-xs text-zinc-600">{row.error ?? "—"}</p>
                    </td>
                    <td className={tdClass}>
                      <button
                        type="button"
                        className={btnClass}
                        disabled={pending}
                        onClick={() => runAction(() => retryLessonLogSyncRow(row.notionPageId))}
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Unresolved onboarding conflicts
        </h2>
        <div className={tableWrap}>
          <table className="min-w-full text-left">
            <thead className="border-b border-zinc-100 bg-zinc-50/80">
              <tr>
                <th className={thClass}>Person</th>
                <th className={thClass}>Email</th>
                <th className={thClass}>Reason</th>
                <th className={thClass}>Stuck</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.conflicts.length === 0 && data.grantQueue.length === 0 ? (
                <tr>
                  <td className={`${tdClass} text-zinc-500`} colSpan={5}>
                    No open lead-link conflicts or grant-queue rows.
                  </td>
                </tr>
              ) : (
                <>
                  {data.conflicts.map((row) => (
                    <tr key={`conflict-${row.id}`}>
                      <td className={tdClass}>{row.person}</td>
                      <td className={tdClass}>{row.email ?? "—"}</td>
                      <td className={tdClass}>
                        <p className="max-w-sm text-xs text-zinc-600">{row.reason}</p>
                      </td>
                      <td className={tdClass}>{timeAgo(row.stuckSince)}</td>
                      <td className={tdClass}>
                        <button
                          type="button"
                          className={btnClass}
                          disabled={pending}
                          onClick={() => runAction(() => resolveLeadLinkConflict(row.id))}
                        >
                          Mark resolved
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.grantQueue.map((row) => (
                    <tr key={`grant-${row.id}`}>
                      <td className={tdClass}>{row.person}</td>
                      <td className={tdClass}>{row.email ?? "—"}</td>
                      <td className={tdClass}>
                        <p className="max-w-sm text-xs text-zinc-600">{row.reason}</p>
                      </td>
                      <td className={tdClass}>{timeAgo(row.stuckSince)}</td>
                      <td className={tdClass}>
                        <button
                          type="button"
                          className={btnClass}
                          disabled={pending}
                          onClick={() => runAction(() => retryGrantQueueItem(row.id))}
                        >
                          Retry grant
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminHubPage>
  );
}
