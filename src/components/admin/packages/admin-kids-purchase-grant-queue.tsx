"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchKidsPurchaseGrantQueue } from "@/app/admin/packages/kids-purchase-queue-actions";
import { formatTimeOpen } from "@/lib/admin/format-time-open";
import type { KidsPurchaseGrantQueueRow } from "@/lib/admin/kids-purchase-grant-queue-types";

export function AdminKidsPurchaseGrantQueue() {
  const [rows, setRows] = useState<KidsPurchaseGrantQueueRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchKidsPurchaseGrantQueue().then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="px-4 py-8 text-sm text-zinc-500">Loading kids purchases…</p>;
  }

  if (error) {
    return <p className="px-4 py-8 text-sm text-red-600">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-zinc-500">No unresolved kids purchases</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-4 py-3">Parent email</th>
            <th className="px-3 py-3">Kid</th>
            <th className="px-3 py-3">Reason</th>
            <th className="px-3 py-3">Open</th>
            <th className="px-3 py-3">Cohort</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => {
            const open = openId === row.id;
            return (
              <QueueRow
                key={row.id}
                row={row}
                open={open}
                onToggle={() => setOpenId(open ? null : row.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QueueRow({
  row,
  open,
  onToggle,
}: {
  row: KidsPurchaseGrantQueueRow;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-zinc-50/50"
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={open}
      >
        <td className="px-4 py-3 font-medium text-zinc-900">{row.parentEmail ?? "—"}</td>
        <td className="px-3 py-3 text-zinc-700">{row.kidName ?? "—"}</td>
        <td className="px-3 py-3 text-zinc-600">{row.reason}</td>
        <td className="whitespace-nowrap px-3 py-3 text-zinc-600">{formatTimeOpen(row.createdAt)}</td>
        <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
          {row.cohortId ? (
            <Link
              href={`/admin/packages/${row.cohortId}`}
              className="font-medium text-violet-600 hover:text-violet-500"
            >
              {row.cohortName ?? "Cohort"}
            </Link>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </td>
      </tr>
      {open ? (
        <tr className="bg-zinc-50/70">
          <td colSpan={5} className="px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Stripe checkout session
            </p>
            <p className="mt-1 break-all font-mono text-sm text-zinc-800">
              {row.stripeCheckoutSessionId}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Raw metadata
            </p>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
              {JSON.stringify(row.rawMetadata, null, 2)}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}
