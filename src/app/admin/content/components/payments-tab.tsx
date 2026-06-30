"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  listAdminStripePayments,
  sendPaymentInviteEmail,
  syncPaymentAccessForEmail,
} from "@/app/admin/content/payments-actions";
import { formatTierLabels, type AdminPaymentRow } from "@/lib/stripe/admin-payment-types";
import { inputClass, labelClass, SectionCard, buttonClass, secondaryButtonClass } from "./ui";

const PAGE_SIZE = 25;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mergePayments(existing: AdminPaymentRow[], incoming: AdminPaymentRow[]): AdminPaymentRow[] {
  const seen = new Set(existing.map((row) => row.sessionId));
  const merged = [...existing];
  for (const row of incoming) {
    if (seen.has(row.sessionId)) continue;
    seen.add(row.sessionId);
    merged.push(row);
  }
  return merged;
}

export function PaymentsTab() {
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncingEmail, setSyncingEmail] = useState<string | null>(null);
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(
    async (options: { reset: boolean; cursor?: string | null }) => {
      const result = await listAdminStripePayments({
        search: debouncedSearch || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        startingAfter: options.reset ? undefined : options.cursor ?? undefined,
        pageSize: PAGE_SIZE,
      });

      if (result.error) {
        return { error: result.error, payments: [] as AdminPaymentRow[], hasMore: false, nextCursor: null };
      }

      return result;
    },
    [debouncedSearch, fromDate, toDate]
  );

  const loadInitial = useCallback(() => {
    startTransition(async () => {
      setLoadError(null);
      setMessage(null);
      const result = await fetchPage({ reset: true });
      if (result.error) {
        setLoadError(result.error);
        setPayments([]);
        setHasMore(false);
        setNextCursor(null);
        return;
      }
      setPayments(result.payments);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore || pending) return;
    setLoadingMore(true);
    const result = await fetchPage({ reset: false, cursor: nextCursor });
    setLoadingMore(false);
    if (result.error) {
      setLoadError(result.error);
      return;
    }
    setPayments((current) => mergePayments(current, result.payments));
    setHasMore(result.hasMore);
    setNextCursor(result.nextCursor);
  }, [fetchPage, hasMore, nextCursor, loadingMore, pending]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const grantAccess = async (email: string) => {
    setSyncingEmail(email);
    setMessage(null);
    const result = await syncPaymentAccessForEmail(email);
    setSyncingEmail(null);
    setMessage(result.success ?? result.error ?? null);
    if (result.success) loadInitial();
  };

  const sendInvite = async (payment: AdminPaymentRow) => {
    if (!payment.email) return;
    setInvitingEmail(payment.email);
    setMessage(null);
    const productLabel = payment.products[0] ?? formatTierLabels(payment.tiers);
    const result = await sendPaymentInviteEmail(payment.email, productLabel);
    setInvitingEmail(null);
    setMessage(result.success ?? result.error ?? null);
  };

  const filtersActive = Boolean(debouncedSearch || fromDate || toDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Stripe checkout payments, newest first. Search by email or name, filter by date, and
          scroll for older payments.
        </p>
        <button type="button" onClick={loadInitial} disabled={pending} className={secondaryButtonClass}>
          {pending ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>
            Search
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email, name, product…"
              className={inputClass}
              autoComplete="off"
            />
          </label>
          <label className={labelClass}>
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!filtersActive}
              onClick={() => {
                setSearch("");
                setFromDate("");
                setToDate("");
              }}
              className={`${secondaryButtonClass} w-full`}
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loadError}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      ) : null}

      <SectionCard title={`Payments (${payments.length}${hasMore ? "+" : ""})`}>
        {pending && payments.length === 0 ? (
          <p className="text-sm text-zinc-500">Loading payments from Stripe…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {filtersActive
              ? "No payments match your search or date range."
              : "No paid checkout sessions found."}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-zinc-100">
              {payments.map((payment) => (
                <li key={payment.sessionId} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900">
                        {payment.amountLabel ?? "—"}
                        {payment.email ? (
                          <span className="font-normal text-zinc-500"> · {payment.email}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        {payment.products.join(", ") || "Purchase"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">{formatWhen(payment.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                        {formatTierLabels(payment.tiers)}
                      </span>
                      {payment.appUserId ? (
                        <>
                          <span className="text-xs font-medium text-emerald-700">
                            App: {payment.appUserLabel}
                          </span>
                          <button
                            type="button"
                            disabled={syncingEmail === payment.email}
                            onClick={() => payment.email && void grantAccess(payment.email)}
                            className="text-xs font-semibold text-violet-600 underline"
                          >
                            {syncingEmail === payment.email ? "Syncing…" : "Re-sync access"}
                          </button>
                        </>
                      ) : payment.email ? (
                        <>
                          <span className="text-xs font-medium text-amber-700">
                            No Kidda account yet
                          </span>
                          <button
                            type="button"
                            disabled={invitingEmail === payment.email}
                            onClick={() => void sendInvite(payment)}
                            className={buttonClass}
                          >
                            {invitingEmail === payment.email ? "Sending…" : "Send invite"}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400">No email on payment</span>
                      )}
                      <a
                        href={payment.stripeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-violet-600 hover:text-violet-500"
                      >
                        Open in Stripe →
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div ref={loadMoreRef} className="mt-4 flex justify-center border-t border-zinc-100 pt-4">
              {hasMore ? (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore || pending}
                  className={secondaryButtonClass}
                >
                  {loadingMore ? "Loading more…" : "Load more payments"}
                </button>
              ) : (
                <p className="text-xs text-zinc-400">End of list</p>
              )}
            </div>
          </>
        )}
      </SectionCard>

      <p className="text-xs text-zinc-500">
        When someone pays but has no account, click Send invite — they get an email to set a
        password and join Kidda. Course access syncs automatically when they sign in with the
        same email as Stripe. If they already have an account, use Re-sync access.
      </p>
    </div>
  );
}
