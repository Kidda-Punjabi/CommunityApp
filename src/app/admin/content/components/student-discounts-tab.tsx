"use client";

import {
  getStudentDiscountEvidenceUrl,
  loadAdminStudentDiscountRequests,
  reviewStudentDiscountRequest,
} from "@/app/admin/content/student-discount-actions";
import {
  verifiedDiscountRequestLabel,
  type StudentDiscountCourseFormat,
  type VerifiedDiscountType,
} from "@/lib/student-discounts/constants";
import type { AdminStudentDiscountRequest } from "@/lib/student-discounts/types";
import { ui } from "@/lib/ui/styles";
import { useEffect, useState, useTransition } from "react";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function statusBadge(status: AdminStudentDiscountRequest["status"]): string {
  if (status === "approved") return "bg-green-50 text-green-700";
  if (status === "rejected") return "bg-zinc-100 text-zinc-600";
  return "bg-amber-50 text-amber-800";
}

function EvidenceViewer({ storagePath, mimeType }: { storagePath: string; mimeType: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getStudentDiscountEvidenceUrl(storagePath).then((result) => {
      if (cancelled) return;
      if (result.url) setUrl(result.url);
      else setError(result.error ?? "Could not load evidence.");
    });

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!url) return <p className="text-sm text-zinc-500">Loading evidence…</p>;

  if (mimeType === "application/pdf") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex text-sm font-semibold text-violet-600 hover:text-violet-500"
      >
        Open uploaded PDF →
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Student ID evidence"
        className="max-h-64 w-full rounded-xl border border-zinc-200 object-contain bg-zinc-50"
      />
    </a>
  );
}

function ReviewCard({
  request,
  onReviewed,
}: {
  request: AdminStudentDiscountRequest;
  onReviewed: (id: string, status: "approved" | "rejected") => void;
}) {
  const [notes, setNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await reviewStudentDiscountRequest(
        request.id,
        decision,
        notes.trim() || null,
        discountCode.trim() || null
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onReviewed(request.id, decision);
    });
  }

  return (
    <li className={ui.cardBordered}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-900">{request.studentName}</p>
          {request.studentEmail && (
            <p className="mt-0.5 text-sm text-zinc-500">{request.studentEmail}</p>
          )}
          <p className="mt-2 text-sm text-zinc-700">
            {verifiedDiscountRequestLabel(
              request.courseFormat as StudentDiscountCourseFormat,
              request.discountType as VerifiedDiscountType
            )}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Submitted {formatDate(request.createdAt)}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadge(request.status)}`}
        >
          {request.status}
        </span>
      </div>

      <div className="mt-4">
        <EvidenceViewer storagePath={request.storagePath} mimeType={request.mimeType} />
      </div>

      {request.status === "pending" ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">
              Discount code (optional — uses env default if blank)
            </span>
            <input
              value={discountCode}
              onChange={(event) => setDiscountCode(event.target.value)}
              placeholder="Stripe promo code"
              className={`mt-1 ${ui.input}`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">Notes to student (optional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900"
              placeholder="Reason if rejecting, or extra instructions"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit("approved")}
              className={ui.btnPrimary}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit("rejected")}
              className={ui.btnSecondary}
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-1 text-sm text-zinc-600">
          {request.discountCode && (
            <p>
              <span className="font-medium text-zinc-800">Code:</span>{" "}
              <span className="font-mono">{request.discountCode}</span>
            </p>
          )}
          {request.adminNotes && <p>{request.adminNotes}</p>}
          {request.reviewedAt && (
            <p className="text-xs text-zinc-500">Reviewed {formatDate(request.reviewedAt)}</p>
          )}
        </div>
      )}
    </li>
  );
}

export function StudentDiscountsTab() {
  const [requests, setRequests] = useState<AdminStudentDiscountRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadAdminStudentDiscountRequests().then((result) => {
      if (cancelled) return;
      setRequests(result.requests);
      setLoadError(result.error ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const pending = requests.filter((request) => request.status === "pending");
  const reviewed = requests.filter((request) => request.status !== "pending");

  function handleReviewed(id: string, status: "approved" | "rejected") {
    setRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status } : request))
    );
    loadAdminStudentDiscountRequests().then((result) => {
      if (!result.error) setRequests(result.requests);
    });
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading discount applications…</p>;
  }

  return (
    <div className="space-y-8">
      {loadError && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </p>
      )}

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No pending discount applications.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map((request) => (
              <ReviewCard key={request.id} request={request} onReviewed={handleReviewed} />
            ))}
          </ul>
        )}
      </div>

      {reviewed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Reviewed</h2>
          <ul className="mt-4 space-y-4">
            {reviewed.map((request) => (
              <ReviewCard key={request.id} request={request} onReviewed={handleReviewed} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
