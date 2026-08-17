"use client";

import {
  fetchUnmatchedWebhookGrants,
  retrySpecificWebhookGrantAction,
  retryWebhookGrantsAction,
} from "@/app/admin/webhook-grants/actions";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(new Date(iso));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type UnmatchedEvent = Awaited<
  ReturnType<typeof fetchUnmatchedWebhookGrants>
>["events"][number];

export function AdminWebhookGrantsSection() {
  const [events, setEvents] = useState<UnmatchedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  function reload() {
    setLoading(true);
    setError(null);
    void fetchUnmatchedWebhookGrants().then((result) => {
      if (result.error) {
        setError(result.error);
      }
      setEvents(result.events);
      setLoading(false);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  function handleRetryAll() {
    setError(null);
    setSuccess(null);
    startTransition(() => {
      void retryWebhookGrantsAction().then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(result.success ?? "Retry completed");
        reload();
      });
    });
  }

  function handleRetryOne(eventId: string) {
    setError(null);
    setSuccess(null);
    startTransition(() => {
      void retrySpecificWebhookGrantAction(eventId).then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(result.success ?? "Retry completed");
        reload();
      });
    });
  }

  const pendingCount = events.filter((e) => e.grantStatus === "pending").length;
  const failedCount = events.filter((e) => e.grantStatus === "failed").length;
  const needsRetryCount = events.filter((e) => e.grantStatus === "needs_retry").length;

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
          Stripe Webhook Grants
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Track and retry payment webhooks that haven't resulted in complete access grants.
          This catches "payment before signup" cases where Stripe payment succeeds but the
          user hasn't signed up yet, or Notion lead is missing App User ID.
        </p>
      </div>

      {events.length > 0 && (
        <section className={`${ui.cardBordered} mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Summary</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {pendingCount} pending · {needsRetryCount} needs retry · {failedCount} failed
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetryAll}
              disabled={pending}
              className={ui.btnPrimary}
            >
              Retry All
            </button>
          </div>
        </section>
      )}

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

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No unmatched webhook grants. All payments have resulted in complete access grants.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const summary = event.payloadSummary;
            const statusColor =
              event.grantStatus === "pending"
                ? "text-amber-700"
                : event.grantStatus === "failed"
                  ? "text-red-700"
                  : "text-orange-700";

            return (
              <div
                key={event.eventId}
                className={`${ui.cardBordered} ${
                  event.grantStatus === "failed"
                    ? "border-red-200 bg-red-50/40"
                    : "border-amber-200 bg-amber-50/40"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <h3 className="font-medium text-zinc-900">
                        {event.email ?? "No email"}
                      </h3>
                      <span className={`text-sm font-medium ${statusColor}`}>
                        {event.grantStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      Event: {event.eventId.slice(0, 24)}… · Session:{" "}
                      {event.sessionId?.slice(0, 24) ?? "none"}…
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Received: {formatDateTime(event.receivedAt)} · Retries:{" "}
                      {event.retryCount}
                      {event.lastRetry ? ` · Last: ${formatDate(event.lastRetry)}` : ""}
                    </p>

                    {summary && (
                      <div className="mt-2 text-sm text-zinc-600">
                        <p>
                          Amount: £
                          {typeof summary.amount_total === "number"
                            ? (summary.amount_total / 100).toFixed(2)
                            : "—"}{" "}
                          · Key: {(summary.checkout_key as string) ?? "—"}
                        </p>
                      </div>
                    )}

                    {event.verification && (
                      <div className="mt-3 rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Verification
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p
                              className={
                                event.verification.hasCohortMember
                                  ? "text-emerald-700"
                                  : "text-zinc-400"
                              }
                            >
                              {event.verification.hasCohortMember ? "✓" : "✗"} Cohort
                              member
                            </p>
                            <p
                              className={
                                event.verification.hasCourseEnrollment
                                  ? "text-emerald-700"
                                  : "text-red-700"
                              }
                            >
                              {event.verification.hasCourseEnrollment ? "✓" : "✗"} Course
                              enrollment
                            </p>
                          </div>
                          <div>
                            <p
                              className={
                                event.verification.hasStudentPackage
                                  ? "text-emerald-700"
                                  : "text-red-700"
                              }
                            >
                              {event.verification.hasStudentPackage ? "✓" : "✗"} Student
                              package
                            </p>
                            <p
                              className={
                                event.verification.hasProfileCourseAccess
                                  ? "text-emerald-700"
                                  : "text-red-700"
                              }
                            >
                              {event.verification.hasProfileCourseAccess ? "✓" : "✗"}{" "}
                              Profile access
                            </p>
                          </div>
                        </div>
                        {event.verification.missingRecords.length > 0 && (
                          <p className="mt-2 text-xs text-red-700">
                            Missing: {event.verification.missingRecords.join(", ")}
                          </p>
                        )}
                      </div>
                    )}

                    {!event.profileId && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        No profile matched yet. User may not have signed up, or email
                        doesn't match.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRetryOne(event.eventId)}
                    disabled={pending}
                    className={ui.btnSecondary}
                  >
                    Retry
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
