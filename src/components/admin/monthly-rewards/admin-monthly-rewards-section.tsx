"use client";

import {
  calculateMonthlyWinnersAction,
  confirmMonthlyWinnersAction,
  fetchMonthlyWinnersForMonth,
  markMonthlyWinnerSentAction,
} from "@/app/admin/monthly-rewards/actions";
import {
  formatMonthLabel,
  getPreviousMonthStart,
  normalizeMonthStart,
  toMonthInputValue,
} from "@/lib/admin/monthly-rewards/month";
import type {
  MonthlyRewardWinnerRow,
  MonthlyWinnerPreview,
} from "@/lib/admin/monthly-rewards/types";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

function giftLabel(amount: number): string {
  return `£${amount.toFixed(0)}`;
}

function initialMonthFromSearch(param: string | null): string {
  if (param) {
    const normalized = normalizeMonthStart(param);
    if (normalized) return normalized;
  }
  return getPreviousMonthStart();
}

export function AdminMonthlyRewardsSection() {
  const searchParams = useSearchParams();
  const [monthStart, setMonthStart] = useState(() =>
    initialMonthFromSearch(searchParams.get("month"))
  );
  const [savedRows, setSavedRows] = useState<MonthlyRewardWinnerRow[]>([]);
  const [preview, setPreview] = useState<MonthlyWinnerPreview[] | null>(null);
  const [giftRefs, setGiftRefs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  function reloadSaved(nextMonth = monthStart) {
    setLoading(true);
    setError(null);
    void fetchMonthlyWinnersForMonth(nextMonth).then((result) => {
      setSavedRows(result.rows);
      setError(result.error ?? null);
      setGiftRefs((prev) => {
        const next = { ...prev };
        for (const row of result.rows) {
          if (row.giftReference && !next[row.id]) {
            next[row.id] = row.giftReference;
          }
        }
        return next;
      });
      setLoading(false);
    });
  }

  useEffect(() => {
    reloadSaved(monthStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when month changes
  }, [monthStart]);

  function onMonthChange(value: string) {
    const normalized = normalizeMonthStart(value);
    if (!normalized) return;
    setMonthStart(normalized);
    setPreview(null);
    setSuccess(null);
  }

  function onCalculate() {
    setError(null);
    setSuccess(null);
    startTransition(() => {
      void calculateMonthlyWinnersAction(monthStart).then((result) => {
        if (result.error) {
          setError(result.error);
          setPreview(null);
          return;
        }
        setPreview(result.preview);
        if (result.preview.length === 0) {
          setSuccess(null);
          setError(`No weekly points found for ${formatMonthLabel(monthStart)}.`);
        }
      });
    });
  }

  function onConfirmSave() {
    if (!preview || preview.length === 0) return;
    setError(null);
    setSuccess(null);
    startTransition(() => {
      void confirmMonthlyWinnersAction(monthStart, preview).then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(result.success ?? "Winners saved.");
        setPreview(null);
        reloadSaved(monthStart);
      });
    });
  }

  function onMarkSent(id: string) {
    setError(null);
    setSuccess(null);
    startTransition(() => {
      void markMonthlyWinnerSentAction(id, giftRefs[id] ?? "").then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(result.success ?? "Marked as sent.");
        reloadSaved(monthStart);
      });
    });
  }

  const alreadySaved = savedRows.length > 0;
  const monthLabel = formatMonthLabel(monthStart);

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link
          href="/admin/content"
          className="text-sm font-medium text-zinc-500 hover:text-violet-600"
        >
          ← Home
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
          Monthly Rewards
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Calculate top 3 from weekly points, save winners, then mark Prezzee gift cards as
          sent.
        </p>
      </div>

      <section className={`${ui.cardBordered} mb-6`}>
        <label className="block text-sm font-medium text-zinc-700" htmlFor="reward-month">
          Month
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id="reward-month"
            type="month"
            value={toMonthInputValue(monthStart)}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
          <button
            type="button"
            onClick={onCalculate}
            disabled={pending}
            className={ui.btnPrimary}
          >
            Calculate Winners
          </button>
          {preview && preview.length > 0 && !alreadySaved ? (
            <button
              type="button"
              onClick={onConfirmSave}
              disabled={pending}
              className={ui.btnSecondary}
            >
              Confirm &amp; Save
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Defaults to the previous full month. Weeks are included when{" "}
          <code className="rounded bg-zinc-100 px-1">week_start</code> falls inside{" "}
          {monthLabel}.
        </p>
      </section>

      {error ? (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}

      {preview ? (
        <section className="mb-8">
          <h2 className={ui.sectionTitle}>Preview — {monthLabel}</h2>
          {preview.length === 0 ? (
            <p className="text-sm text-zinc-500">No eligible members for this month.</p>
          ) : (
            <div className={`${ui.cardBordered} overflow-x-auto p-0`}>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Rank</th>
                    <th className="px-5 py-3 font-semibold">Member</th>
                    <th className="px-5 py-3 font-semibold">Points</th>
                    <th className="px-5 py-3 font-semibold">Gift card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {preview.map((row) => (
                    <tr key={row.userId}>
                      <td className="px-5 py-3 font-medium text-zinc-900">{row.rank}</td>
                      <td className="px-5 py-3 text-zinc-900">{row.displayName}</td>
                      <td className="px-5 py-3 text-zinc-700">{row.pointsTotal}</td>
                      <td className="px-5 py-3 text-zinc-700">{giftLabel(row.giftCardAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {alreadySaved ? (
            <p className="mt-3 text-sm text-zinc-500">
              Winners for this month are already saved. Confirm &amp; Save is disabled.
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className={ui.sectionTitle}>Saved winners — {monthLabel}</h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : savedRows.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No winners saved for this month yet. Calculate, then Confirm &amp; Save.
          </p>
        ) : (
          <div className={`${ui.cardBordered} divide-y divide-zinc-100 p-0`}>
            {savedRows.map((row) => (
              <div key={row.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      #{row.rank} · {row.displayName}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {row.pointsTotal} pts · {giftLabel(row.giftCardAmount)} ·{" "}
                      <span
                        className={
                          row.status === "sent" ? "text-emerald-700" : "text-amber-700"
                        }
                      >
                        {row.status}
                      </span>
                    </p>
                  </div>
                </div>

                {row.status === "sent" ? (
                  <p className="mt-2 break-all text-xs text-zinc-500">
                    Sent {row.sentAt ? new Date(row.sentAt).toLocaleString() : ""}
                    {row.giftReference ? ` · ${row.giftReference}` : ""}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="url"
                      placeholder="Paste Prezzee link…"
                      value={giftRefs[row.id] ?? ""}
                      onChange={(e) =>
                        setGiftRefs((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      className="block w-full rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => onMarkSent(row.id)}
                      disabled={pending}
                      className={ui.btnSecondary}
                    >
                      Mark as Sent
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
