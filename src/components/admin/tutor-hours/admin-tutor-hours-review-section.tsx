"use client";

import {
  confirmTutorHoursReviewItems,
  fetchAdminTutorHoursReview,
  type ReviewConfirmItem,
} from "@/app/admin/tutor-hours/review-actions";
import {
  formatWeekRangeLabel,
  formatWeekStartParam,
  parseWeekStartParam,
} from "@/lib/admin/load-admin-tutor-hours";
import type {
  TutorHoursReviewEvent,
  TutorHoursReviewTutor,
} from "@/lib/admin/load-admin-tutor-hours-review";
import {
  REVIEW_CATEGORY_LABELS,
  type ReviewCategory,
} from "@/lib/admin/suggest-calendar-category";
import { KIDDA_WORK_CATEGORY_LABELS } from "@/lib/calendar/event-tags";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import { startOfWeekMonday } from "@/lib/calendar/time-grid-calendar";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const CATEGORY_OPTIONS: ReviewCategory[] = [
  "lesson_needs_matching",
  "kidda_meeting",
  "kidda_admin",
  "kidda_prep",
  "personal",
];

export function AdminTutorHoursReviewSection() {
  const [weekStart] = useState(() => formatWeekStartParam(startOfWeekMonday(new Date())));
  const [tutors, setTutors] = useState<TutorHoursReviewTutor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [choices, setChoices] = useState<Record<string, ReviewCategory>>({});
  const [scopes, setScopes] = useState<Record<string, "event" | "series">>({});
  const [flagged, setFlagged] = useState<Array<{ title: string; tutorId: string; sessionId: string }>>([]);

  const rangeLabel = formatWeekRangeLabel(parseWeekStartParam(weekStart));

  function reload() {
    setLoading(true);
    void fetchAdminTutorHoursReview(weekStart).then((result) => {
      setTutors(result.tutors);
      setError(result.error ?? null);
      const nextChoices: Record<string, ReviewCategory> = {};
      const nextScopes: Record<string, "event" | "series"> = {};
      for (const tutor of result.tutors) {
        for (const event of tutor.pending) {
          nextChoices[event.sessionId] = event.suggested;
          nextScopes[event.sessionId] = event.googleRecurringEventId ? "series" : "event";
        }
      }
      setChoices(nextChoices);
      setScopes(nextScopes);
      setLoading(false);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load current week once
  }, [weekStart]);

  async function confirmItems(items: ReviewConfirmItem[]) {
    if (items.length === 0) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await confirmTutorHoursReviewItems(items);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.flagged.length > 0) {
      setFlagged((current) => [...result.flagged, ...current]);
    }
    const parts = [
      result.tagged ? `${result.tagged} tagged` : null,
      result.excluded ? `${result.excluded} marked personal` : null,
      result.flagged.length ? `${result.flagged.length} flagged for matching` : null,
    ].filter(Boolean);
    setSuccess(parts.join(" · ") || "Nothing to write.");
    reload();
  }

  return (
    <div className={ui.page}>
      <Link
        href="/admin/tutor-hours"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to Tutor hours
      </Link>

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Review unmatched events</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Suggestions only — nothing is saved until you confirm. Going-forward week: {rangeLabel}.
          This is not an official pay record.
        </p>
      </div>

      {flagged.length > 0 ? (
        <section className={`${ui.cardBordered} mb-6`}>
          <h2 className="text-sm font-semibold text-zinc-900">Flagged for calendar matching</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Not written to the database. These look like lessons that matching missed.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-zinc-700">
            {flagged.map((item) => (
              <li key={item.sessionId}>{item.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading unmatched events…</p>
      ) : tutors.length === 0 ? (
        <p className="text-sm text-zinc-500">No tutors found.</p>
      ) : (
        <div className="space-y-8">
          {tutors.map((tutor) => (
            <TutorReviewBlock
              key={tutor.tutorId}
              tutor={tutor}
              choices={choices}
              scopes={scopes}
              pending={pending}
              onChoice={(sessionId, category) =>
                setChoices((current) => ({ ...current, [sessionId]: category }))
              }
              onScope={(sessionId, scope) =>
                setScopes((current) => ({ ...current, [sessionId]: scope }))
              }
              onConfirm={(items) => void confirmItems(items)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TutorReviewBlock({
  tutor,
  choices,
  scopes,
  pending,
  onChoice,
  onScope,
  onConfirm,
}: {
  tutor: TutorHoursReviewTutor;
  choices: Record<string, ReviewCategory>;
  scopes: Record<string, "event" | "series">;
  pending: boolean;
  onChoice: (sessionId: string, category: ReviewCategory) => void;
  onScope: (sessionId: string, scope: "event" | "series") => void;
  onConfirm: (items: ReviewConfirmItem[]) => void;
}) {
  const bulkCounts = useMemo(() => {
    const counts: Partial<Record<ReviewCategory, number>> = {};
    for (const event of tutor.pending) {
      const category = choices[event.sessionId] ?? event.suggested;
      counts[category] = (counts[category] ?? 0) + 1;
    }
    return counts;
  }, [choices, tutor.pending]);

  function itemsFor(filter: ReviewCategory | "all"): ReviewConfirmItem[] {
    return tutor.pending
      .filter((event) => filter === "all" || (choices[event.sessionId] ?? event.suggested) === filter)
      .map((event) => ({
        sessionId: event.sessionId,
        category: choices[event.sessionId] ?? event.suggested,
        scope: scopes[event.sessionId] ?? (event.googleRecurringEventId ? "series" : "event"),
      }));
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{tutor.displayName}</h2>
          {tutor.email ? <p className="text-sm text-zinc-500">{tutor.email}</p> : null}
        </div>
        {tutor.pending.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(["kidda_admin", "kidda_meeting", "kidda_prep", "personal"] as const).map((category) =>
              (bulkCounts[category] ?? 0) > 0 ? (
                <button
                  key={category}
                  type="button"
                  disabled={pending}
                  onClick={() => onConfirm(itemsFor(category))}
                  className={ui.btnGhost}
                >
                  Confirm all {REVIEW_CATEGORY_LABELS[category]} ({bulkCounts[category]})
                </button>
              ) : null
            )}
          </div>
        ) : null}
      </div>

      {tutor.pending.length === 0 ? (
        <p className="text-sm text-zinc-500">No unmatched untagged events this week.</p>
      ) : (
        <ul className="space-y-3">
          {tutor.pending.map((event) => (
            <ReviewEventRow
              key={event.sessionId}
              event={event}
              category={choices[event.sessionId] ?? event.suggested}
              scope={scopes[event.sessionId] ?? (event.googleRecurringEventId ? "series" : "event")}
              pending={pending}
              onChoice={onChoice}
              onScope={onScope}
              onConfirm={() =>
                onConfirm([
                  {
                    sessionId: event.sessionId,
                    category: choices[event.sessionId] ?? event.suggested,
                    scope:
                      scopes[event.sessionId] ??
                      (event.googleRecurringEventId ? "series" : "event"),
                  },
                ])
              }
            />
          ))}
        </ul>
      )}

      {tutor.alreadyTagged.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Already tagged
          </h3>
          <ul className="space-y-1 text-sm text-zinc-600">
            {tutor.alreadyTagged.map((row, index) => (
              <li key={`${row.taggedById}-${row.createdAt}-${index}`}>
                {KIDDA_WORK_CATEGORY_LABELS[row.category]} · {row.title ?? "Untitled"} · tagged by{" "}
                {row.taggedByName}
                {row.taggedById === tutor.tutorId ? " (tutor)" : " (admin)"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ReviewEventRow({
  event,
  category,
  scope,
  pending,
  onChoice,
  onScope,
  onConfirm,
}: {
  event: TutorHoursReviewEvent;
  category: ReviewCategory;
  scope: "event" | "series";
  pending: boolean;
  onChoice: (sessionId: string, category: ReviewCategory) => void;
  onScope: (sessionId: string, scope: "event" | "series") => void;
  onConfirm: () => void;
}) {
  return (
    <li className={ui.cardBordered}>
      <p className="font-semibold text-zinc-900">{event.title}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {formatSessionWhen(event.startsAt, event.endsAt)}
        {event.occurrenceCount > 1 ? ` · ${event.occurrenceCount} times this week` : ""}
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Suggested: {REVIEW_CATEGORY_LABELS[event.suggested]} — {event.suggestionReason}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={category}
          disabled={pending}
          onChange={(change) => onChoice(event.sessionId, change.target.value as ReviewCategory)}
          className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {REVIEW_CATEGORY_LABELS[option]}
            </option>
          ))}
        </select>
        {event.googleRecurringEventId ? (
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={scope === "series"}
              disabled={pending}
              onChange={(change) =>
                onScope(event.sessionId, change.target.checked ? "series" : "event")
              }
            />
            Whole series
          </label>
        ) : null}
        <button type="button" disabled={pending} onClick={onConfirm} className={ui.btnSecondary}>
          Confirm
        </button>
      </div>
    </li>
  );
}
