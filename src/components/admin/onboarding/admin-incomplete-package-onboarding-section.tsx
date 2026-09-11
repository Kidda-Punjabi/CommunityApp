"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchIncompletePackageChecklists } from "@/app/admin/onboarding/incomplete/actions";
import { toggleOnboardingChecklistField } from "@/app/admin/onboarding/actions";
import { setPackageInstanceAppAccessExpected } from "@/app/admin/packages/actions";
import { AdminStatusPill } from "@/components/admin/admin-filter-pills";
import type { IncompletePackageChecklistRow } from "@/lib/admin/incomplete-package-checklist-types";
import { ONBOARDING_CHECKLIST_COLUMNS } from "@/lib/admin/onboarding/checklist-fields";
import { membershipStatusLabel } from "@/lib/admin/package-status";
import type { OnboardingChecklistRow } from "@/lib/admin/packages/types";
import { ui } from "@/lib/ui/styles";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function checklistValue(
  row: IncompletePackageChecklistRow,
  key: keyof OnboardingChecklistRow
): boolean {
  const value = row.checklist[key];
  return typeof value === "boolean" ? value : false;
}

export function AdminIncompletePackageOnboardingSection() {
  const [rows, setRows] = useState<IncompletePackageChecklistRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [checklistPending, setChecklistPending] = useState<string | null>(null);
  const [appAccessPendingId, setAppAccessPendingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await fetchIncompletePackageChecklists();
    setRows(result.rows);
    setError(result.error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.displayName.toLowerCase().includes(query) ||
        (row.email?.toLowerCase().includes(query) ?? false) ||
        row.courseName.toLowerCase().includes(query) ||
        row.packageName.toLowerCase().includes(query) ||
        row.outstandingLabels.some((label) => label.toLowerCase().includes(query))
    );
  }, [rows, search]);

  async function handleChecklistToggle(
    row: IncompletePackageChecklistRow,
    field: keyof OnboardingChecklistRow,
    checked: boolean
  ) {
    const pendingKey = `${row.studentPackageId}:${field}`;
    setChecklistPending(pendingKey);
    setRows((current) =>
      current.map((entry) => {
        if (entry.studentPackageId !== row.studentPackageId) return entry;
        const checklist = { ...entry.checklist, [field]: checked };
        return {
          ...entry,
          checklist,
          outstandingLabels: entry.outstandingLabels,
        };
      })
    );
    await toggleOnboardingChecklistField(
      row.studentPackageId,
      row.checklistType,
      field,
      checked
    );
    setChecklistPending(null);
    await reload();
  }

  async function handleAppAccessNotExpected(row: IncompletePackageChecklistRow) {
    if (!row.packageInstanceId) return;
    if (
      !window.confirm(
        `Mark “${row.packageName}” as not expecting app access? It will leave Package onboarding incomplete until you turn this back on.`
      )
    ) {
      return;
    }
    setAppAccessPendingId(row.packageInstanceId);
    const result = await setPackageInstanceAppAccessExpected(row.packageInstanceId, false);
    setAppAccessPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRows((current) =>
      current.filter((entry) => entry.packageInstanceId !== row.packageInstanceId)
    );
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link href="/admin" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Admin home
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
          Package onboarding incomplete
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every checklist with onboarding_completed = false, including which setup flags are still
          outstanding — excluding package instances marked as not expecting app access. This is
          the full stale backlog, not the overdue-only Payment setup card.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          Assignment and membership edits stay on{" "}
          <Link href="/admin/onboarding" className="font-medium text-violet-600 hover:text-violet-500">
            Package onboarding
          </Link>
          .
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="mb-4 rounded-2xl border border-zinc-200/80 bg-white p-4">
        <input
          type="search"
          placeholder="Search student, course, package, or outstanding item…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <p className="mt-2 text-xs text-zinc-500">
          {loading
            ? "Loading…"
            : `${filtered.length} checklist${filtered.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading checklists…</p>
      ) : filtered.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">All caught up</p>
          <p className="mt-2 text-sm text-zinc-500">No incomplete package onboarding checklists.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
          <table className="min-w-[72rem] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-50/95 px-3 py-3">Student</th>
                <th className="px-3 py-3">Package</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Still outstanding</th>
                {ONBOARDING_CHECKLIST_COLUMNS.map((column) => (
                  <th key={column.key} className="px-2 py-3 text-center" title={column.label}>
                    {column.header}
                  </th>
                ))}
                <th className="px-3 py-3">App access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((row) => (
                <tr key={row.checklistId} className="hover:bg-zinc-50/50">
                  <td className="sticky left-0 z-10 bg-white px-3 py-3">
                    {row.userId ? (
                      <Link
                        href={`/admin/content/people/members/${row.userId}`}
                        className="font-semibold text-violet-600 hover:text-violet-500"
                      >
                        {row.displayName}
                      </Link>
                    ) : (
                      <p className="font-semibold text-zinc-900">{row.displayName}</p>
                    )}
                    {row.email ? <p className="text-xs text-zinc-500">{row.email}</p> : null}
                    {row.membershipStatus ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {membershipStatusLabel(row.membershipStatus)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">
                    <p>{row.packageName}</p>
                    <p className="text-xs text-zinc-500">{row.courseName}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
                    <p>{formatDate(row.createdAt)}</p>
                    {row.stale ? (
                      <span className="mt-1 inline-block">
                        <AdminStatusPill tone="amber">7+ days</AdminStatusPill>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex max-w-[16rem] flex-wrap gap-1">
                      {row.outstandingLabels.length === 0 ? (
                        <span className="text-xs text-zinc-400">Only overall flag left</span>
                      ) : (
                        row.outstandingLabels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800"
                          >
                            {label}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  {ONBOARDING_CHECKLIST_COLUMNS.map((column) => (
                    <td key={column.key} className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={checklistValue(row, column.key)}
                        disabled={checklistPending === `${row.studentPackageId}:${column.key}`}
                        title={column.label}
                        onChange={(event) =>
                          void handleChecklistToggle(row, column.key, event.target.checked)
                        }
                        className="h-4 w-4 rounded border-zinc-300 text-violet-600"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    {row.packageInstanceId ? (
                      <button
                        type="button"
                        disabled={appAccessPendingId === row.packageInstanceId}
                        onClick={() => void handleAppAccessNotExpected(row)}
                        className={`${ui.btnPrimary} px-4 py-2 text-xs disabled:opacity-60`}
                      >
                        {appAccessPendingId === row.packageInstanceId
                          ? "Saving…"
                          : "App access not expected"}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-400">Group cohort</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
