"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchEnrollmentGaps,
  markGrantQueueResolved,
} from "@/app/admin/enrollment-gaps/actions";
import { AdminStatusPill } from "@/components/admin/admin-filter-pills";
import type {
  EnrollmentGrantQueueRow,
  MissingAccessRow,
} from "@/lib/admin/enrollment-gaps-types";
import { notionPageHref } from "@/lib/admin/enrollment-gaps-types";
import { packageStatusLabel, packageStatusPillTone } from "@/lib/admin/package-status";
import { ui } from "@/lib/ui/styles";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AdminEnrollmentGapsSection() {
  const [grantQueue, setGrantQueue] = useState<EnrollmentGrantQueueRow[]>([]);
  const [missingAccess, setMissingAccess] = useState<MissingAccessRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchEnrollmentGaps().then((result) => {
      if (cancelled) return;
      setGrantQueue(result.grantQueue);
      setMissingAccess(result.missingAccess);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMarkResolved(row: EnrollmentGrantQueueRow) {
    const note = (notes[row.id] ?? "").trim();
    if (!note) {
      setActionError("Resolution note is required.");
      return;
    }
    setPendingId(row.id);
    setActionError(null);
    const result = await markGrantQueueResolved(row.id, note);
    setPendingId(null);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setGrantQueue((current) => current.filter((entry) => entry.id !== row.id));
    setNotes((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link href="/admin" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Admin home
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">Enrollment gaps</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Unresolved purchase-grant queue items and active package instances with no student
          package row. Confirm in Notion before enrolling.
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {actionError ? <p className="mb-4 text-sm text-red-600">{actionError}</p> : null}

      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Unresolved grant queue
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {loading
              ? "Loading…"
              : `${grantQueue.length} unresolved ${grantQueue.length === 1 ? "item" : "items"}`}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading queue…</p>
        ) : grantQueue.length === 0 ? (
          <div className={ui.emptyState}>
            <p className="text-lg font-semibold text-zinc-900">Queue is clear</p>
            <p className="mt-2 text-sm text-zinc-500">No unresolved grant-queue items.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
            <table className="min-w-[48rem] text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-3 py-3">Reason</th>
                  <th className="px-3 py-3">Queued</th>
                  <th className="px-3 py-3">Resolve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {grantQueue.map((row) => {
                  const note = notes[row.id] ?? "";
                  const pending = pendingId === row.id;
                  return (
                    <tr key={row.id} className="align-top hover:bg-zinc-50/50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-zinc-900">{row.leadName ?? "Unnamed lead"}</p>
                        {row.leadEmail ? (
                          <p className="text-xs text-zinc-500">{row.leadEmail}</p>
                        ) : null}
                        {row.profileId ? (
                          <Link
                            href={`/admin/content/people/members/${row.profileId}`}
                            className="mt-1 inline-block text-xs font-medium text-violet-600 hover:text-violet-500"
                          >
                            Open profile
                          </Link>
                        ) : (
                          <p className="mt-1 text-xs text-zinc-400">No linked profile</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-zinc-600">{row.reason}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <label className="sr-only" htmlFor={`resolution-note-${row.id}`}>
                          Resolution note
                        </label>
                        <textarea
                          id={`resolution-note-${row.id}`}
                          required
                          rows={2}
                          value={note}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                          placeholder="Resolution note (required)"
                          className="w-full min-w-[14rem] rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={pending || !note.trim()}
                          onClick={() => void handleMarkResolved(row)}
                          className={`${ui.btnPrimary} mt-2 px-4 py-2 text-xs disabled:opacity-60`}
                        >
                          {pending ? "Saving…" : "Mark resolved"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Missing access</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {loading
              ? "Loading…"
              : `${missingAccess.length} package ${missingAccess.length === 1 ? "instance" : "instances"} with no student package`}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading package instances…</p>
        ) : missingAccess.length === 0 ? (
          <div className={ui.emptyState}>
            <p className="text-lg font-semibold text-zinc-900">No missing-access rows</p>
            <p className="mt-2 text-sm text-zinc-500">
              Every scheduled, in-progress, paused, or postponed instance has a student package.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
            <table className="min-w-[40rem] text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Package instance</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Course</th>
                  <th className="px-3 py-3">Notion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {missingAccess.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3 font-semibold text-zinc-900">{row.name}</td>
                    <td className="px-3 py-3">
                      <AdminStatusPill tone={packageStatusPillTone(row.status)}>
                        {packageStatusLabel(row.status)}
                      </AdminStatusPill>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{row.courseName}</td>
                    <td className="px-3 py-3">
                      {row.notionPageId ? (
                        <a
                          href={notionPageHref(row.notionPageId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-violet-600 hover:text-violet-500"
                        >
                          Open in Notion
                        </a>
                      ) : (
                        <span className="text-zinc-400">No Notion page</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
