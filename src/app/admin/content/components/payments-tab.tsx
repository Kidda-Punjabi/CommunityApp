"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  listAdminStripePayments,
  sendPaymentInviteEmail,
  syncPaymentAccessForEmail,
} from "@/app/admin/content/payments-actions";
import { formatTierLabels, type AdminPaymentRow } from "@/lib/stripe/admin-payment-types";
import { SectionCard, buttonClass, secondaryButtonClass } from "./ui";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PaymentsTab() {
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [syncingEmail, setSyncingEmail] = useState<string | null>(null);
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setLoadError(null);
      setMessage(null);
      const result = await listAdminStripePayments(50);
      if (result.error) {
        setLoadError(result.error);
        setPayments([]);
        return;
      }
      setPayments(result.payments);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grantAccess = async (email: string) => {
    setSyncingEmail(email);
    setMessage(null);
    const result = await syncPaymentAccessForEmail(email);
    setSyncingEmail(null);
    setMessage(result.success ?? result.error ?? null);
    if (result.success) load();
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Recent Stripe checkout payments (last 50). Opens in Stripe for receipts and refunds.
        </p>
        <button type="button" onClick={load} disabled={pending} className={secondaryButtonClass}>
          {pending ? "Loading…" : "Refresh"}
        </button>
      </div>

      {loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loadError}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      ) : null}

      <SectionCard title={`Payments (${payments.length})`}>
        {pending && payments.length === 0 ? (
          <p className="text-sm text-zinc-500">Loading payments from Stripe…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-zinc-500">No paid checkout sessions found.</p>
        ) : (
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
                        <span className="text-xs font-medium text-amber-700">No Kidda account yet</span>
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
