"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  fetchAdminIssueReports,
  reopenAdminIssueReport,
  resolveAdminIssueReport,
} from "@/app/admin/issue-reports/actions";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import type { AdminIssueAttachmentView, AdminIssueReportRow } from "@/lib/admin/load-admin-issue-reports";
import { issueErrorMessage } from "@/lib/issues/error-message";
import { formatFileSize, isImageMime, isPdfMime, isVideoMime } from "@/lib/issues/validation";
import { ui } from "@/lib/ui/styles";

type Filter = "open" | "resolved";

export function AdminIssueReportsSection() {
  const [rows, setRows] = useState<AdminIssueReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");

  const reload = useCallback(async () => {
    const result = await fetchAdminIssueReports();
    setRows(result.rows);
    setError(result.error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminIssueReports().then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCount = rows.filter((row) => row.status === "open").length;
  const resolvedCount = rows.filter((row) => row.status === "resolved").length;
  const visible = rows.filter((row) => row.status === filter);

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Issues</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Reports submitted from Profile. Mark them resolved when you&apos;ve handled them.
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <AdminFilterPill
          label={`Open (${openCount})`}
          active={filter === "open"}
          onClick={() => setFilter("open")}
        />
        <AdminFilterPill
          label={`Resolved (${resolvedCount})`}
          active={filter === "resolved"}
          onClick={() => setFilter("resolved")}
        />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : visible.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">No issues</p>
          <p className="mt-2 text-sm text-zinc-500">
            {filter === "open"
              ? "Open reports from Profile appear here."
              : "Resolved reports appear here."}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((row) => (
            <AdminIssueCard key={row.id} row={row} onChanged={() => void reload()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminIssueCard({
  row,
  onChanged,
}: {
  row: AdminIssueReportRow;
  onChanged: () => void;
}) {
  const [note, setNote] = useState(row.adminNotes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function markResolved() {
    startTransition(async () => {
      const result = await resolveAdminIssueReport({
        reportId: row.id,
        adminNotes: note || undefined,
      });
      setMessage(result.success ?? result.error ?? null);
      if (result.success) onChanged();
    });
  }

  function reopen() {
    startTransition(async () => {
      const result = await reopenAdminIssueReport({ reportId: row.id });
      setMessage(result.success ?? result.error ?? null);
      if (result.success) onChanged();
    });
  }

  return (
    <li className={`${ui.cardBordered} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-900">{row.areaLabel}</p>
          <p className="text-sm text-zinc-700">{row.fullName}</p>
          {row.email ? <p className="text-xs text-zinc-500">{row.email}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.emailFailed ? (
            <AdminStatusPill tone="amber">Email failed</AdminStatusPill>
          ) : null}
          <AdminStatusPill tone={row.status === "open" ? "amber" : "green"}>
            {row.status}
          </AdminStatusPill>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm text-zinc-700">{row.description}</p>

      <dl className="grid gap-2 text-sm text-zinc-600 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Submitted</dt>
          <dd className="mt-0.5">{row.submittedLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Page</dt>
          <dd className="mt-0.5 break-all">
            {row.pageUrl ? (
              <a
                href={row.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-700 hover:underline"
              >
                {row.pageUrl}
              </a>
            ) : (
              "Not provided"
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Device / browser
          </dt>
          <dd className="mt-0.5 break-all text-xs">{row.userAgent || "Not provided"}</dd>
        </div>
      </dl>

      {row.attachments.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Attachments</p>
          <ul className="mt-2 space-y-2">
            {row.attachments.map((attachment) => (
              <li key={attachment.path}>
                <AdminIssueAttachment attachment={attachment} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.status === "open" ? (
        <div className="space-y-3 border-t border-zinc-100 pt-3">
          <label className="block text-sm text-zinc-700">
            Admin note (optional)
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={markResolved} className={ui.btnPrimary}>
              Mark resolved
            </button>
          </div>
          {message ? <p className="text-sm text-zinc-600">{issueErrorMessage(message)}</p> : null}
        </div>
      ) : (
        <div className="space-y-3 border-t border-zinc-100 pt-3">
          {row.adminNotes ? (
            <p className="text-sm text-zinc-500">Note: {row.adminNotes}</p>
          ) : null}
          <button type="button" disabled={pending} onClick={reopen} className={ui.btnGhost}>
            Reopen
          </button>
          {message ? <p className="text-sm text-zinc-600">{issueErrorMessage(message)}</p> : null}
        </div>
      )}
    </li>
  );
}

function AdminIssueAttachment({ attachment }: { attachment: AdminIssueAttachmentView }) {
  const url = attachment.signedUrl;
  const label = `${attachment.name} (${formatFileSize(attachment.size)})`;

  if (!url) {
    return <p className="text-sm text-zinc-500">{label} — link unavailable</p>;
  }

  if (isImageMime(attachment.mime_type)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={attachment.name}
          className="h-24 w-24 rounded-xl object-cover ring-1 ring-zinc-200"
        />
        <span className="mt-1 block text-xs text-violet-700">{label}</span>
      </a>
    );
  }

  if (isVideoMime(attachment.mime_type)) {
    return (
      <div className="space-y-1">
        <video src={url} controls className="max-h-48 w-full max-w-md rounded-xl bg-black" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-violet-700 hover:underline"
        >
          {label}
        </a>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-semibold text-violet-700 hover:underline"
    >
      {isPdfMime(attachment.mime_type) ? `PDF · ${label}` : label}
    </a>
  );
}
