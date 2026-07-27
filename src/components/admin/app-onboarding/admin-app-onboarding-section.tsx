"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAdminAppOnboarding } from "@/app/admin/app-onboarding/actions";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import { APP_ONBOARDING_MILESTONE_COLUMNS } from "@/lib/admin/app-onboarding/milestones";
import type {
  AdminAppOnboardingRow,
  AppOnboardingFilter,
} from "@/lib/admin/app-onboarding/types";
import { ui } from "@/lib/ui/styles";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function MilestoneCell({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={done ? "text-green-600" : "text-zinc-300"}
      title={label}
      aria-label={`${label}: ${done ? "complete" : "not yet"}`}
    >
      {done ? "✓" : "—"}
    </span>
  );
}

export function AdminAppOnboardingSection() {
  const [rows, setRows] = useState<AdminAppOnboardingRow[]>([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    inProgressCount: 0,
    completeCount: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<AppOnboardingFilter>("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchAdminAppOnboarding({
      page,
      query: debouncedSearch,
      filter,
    });
    setRows(result.rows);
    setSummary(result.summary);
    setTotalPages(result.totalPages);
    setPage(result.page);
    setError(result.error ?? null);
    setLoading(false);
  }, [page, debouncedSearch, filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter]);

  const filteredLabel = useMemo(() => {
    if (filter === "in_progress") return "in progress";
    if (filter === "complete") return "complete";
    return "all app users";
  }, [filter]);

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">App onboarding</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Everyone who signed up for the app — milestones are filled in automatically from signup,
          email verification, profile, placement test, and practice activity. No manual ticks.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          Package setup (welcome email, calendar, WhatsApp) lives on{" "}
          <Link href="/admin/onboarding" className="font-medium text-violet-600 hover:text-violet-500">
            Package onboarding
          </Link>
          .
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        <AdminFilterPill
          label={`All (${summary.totalCount})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <AdminFilterPill
          label={`In progress (${summary.inProgressCount})`}
          active={filter === "in_progress"}
          onClick={() => setFilter("in_progress")}
        />
        <AdminFilterPill
          label={`Complete (${summary.completeCount})`}
          active={filter === "complete"}
          onClick={() => setFilter("complete")}
        />
      </div>

      <div className="mb-4 rounded-2xl border border-zinc-200/80 bg-white p-4">
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <p className="mt-2 text-xs text-zinc-500">
          {loading
            ? "Loading…"
            : `${rows.length} shown · ${filteredLabel} · page ${page} of ${totalPages}`}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading app users…</p>
      ) : rows.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">No matching app users</p>
          <p className="mt-2 text-sm text-zinc-500">
            Try a different search or filter. New signups appear here automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
          <table className="min-w-[56rem] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-50/95 px-4 py-3">User</th>
                <th className="px-3 py-3">Signed up</th>
                <th className="px-3 py-3">Progress</th>
                <th className="hidden px-3 py-3 sm:table-cell">Level</th>
                {APP_ONBOARDING_MILESTONE_COLUMNS.map((column) => (
                  <th key={column.key} className="px-2 py-3 text-center" title={column.description}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => (
                <tr key={row.userId} className="hover:bg-zinc-50/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3">
                    <Link
                      href={`/admin/content/people/members/${row.userId}`}
                      className="font-semibold text-violet-600 hover:text-violet-500"
                    >
                      {row.displayName}
                    </Link>
                    {row.email && <p className="text-xs text-zinc-500">{row.email}</p>}
                    {row.isComplete && (
                      <AdminStatusPill tone="green">Complete</AdminStatusPill>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
                    {formatDate(row.signedUpAt)}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">
                    {row.progressDone}/{row.progressTotal}
                  </td>
                  <td className="hidden px-3 py-3 text-zinc-600 sm:table-cell">
                    {row.learnerLevel ?? "—"}
                  </td>
                  {APP_ONBOARDING_MILESTONE_COLUMNS.map((column) => (
                    <td key={column.key} className="px-2 py-3 text-center">
                      <MilestoneCell
                        done={row.milestones[column.key]}
                        label={column.label}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
