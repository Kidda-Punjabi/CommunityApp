"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchUnseenAppOnboarding } from "@/app/admin/app-onboarding/unseen/actions";
import { AdminStatusPill } from "@/components/admin/admin-filter-pills";
import type { UnseenAppOnboardingRow } from "@/lib/admin/unseen-app-onboarding-types";
import { ui } from "@/lib/ui/styles";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function AdminUnseenAppOnboardingSection() {
  const [rows, setRows] = useState<UnseenAppOnboardingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchUnseenAppOnboarding().then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.displayName.toLowerCase().includes(query) ||
        (row.email?.toLowerCase().includes(query) ?? false)
    );
  }, [rows, search]);

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link href="/admin" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Admin home
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
          App onboarding incomplete
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Students whose profile still has has_seen_onboarding = false. Staff accounts are excluded.
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="mb-4 rounded-2xl border border-zinc-200/80 bg-white p-4">
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <p className="mt-2 text-xs text-zinc-500">
          {loading ? "Loading…" : `${filtered.length} student${filtered.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading students…</p>
      ) : filtered.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">All caught up</p>
          <p className="mt-2 text-sm text-zinc-500">Everyone has seen in-app onboarding.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
          <table className="min-w-[36rem] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-3 py-3">Signed up</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((row) => (
                <tr key={row.userId} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/content/people/members/${row.userId}`}
                      className="font-semibold text-violet-600 hover:text-violet-500"
                    >
                      {row.displayName}
                    </Link>
                    {row.email ? <p className="text-xs text-zinc-500">{row.email}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
                    {formatDate(row.signedUpAt)}
                  </td>
                  <td className="px-3 py-3">
                    {row.stale ? (
                      <AdminStatusPill tone="amber">Stuck 7+ days</AdminStatusPill>
                    ) : (
                      <AdminStatusPill tone="violet">Signed up under 7 days</AdminStatusPill>
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
