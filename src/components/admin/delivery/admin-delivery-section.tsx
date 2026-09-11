"use client";

import {
  fetchDeliveryDashboard,
  syncFeedbackResponsesNow,
  updateFeedbackTwoWayField,
} from "@/app/admin/content/delivery-actions";
import { DeliveryRatingsChart } from "@/components/admin/delivery/delivery-ratings-chart";
import { AdminFilterPill } from "@/components/admin/admin-filter-pills";
import {
  DELIVERY_CLASS_TYPES,
  DELIVERY_RANGE_PRESETS,
  DELIVERY_TUTORS,
  type DeliveryClassTypeId,
  type DeliveryRangeId,
  type DeliveryTutorName,
} from "@/lib/admin/delivery/constants";
import type {
  DeliveryFiltersInput,
  DeliveryOpsMetric,
  DeliveryRatingMetric,
  DeliverySnapshot,
} from "@/lib/admin/delivery/types";
import { useEffect, useMemo, useState, useTransition } from "react";

const chrome = "rounded-[12px] border-[0.5px] border-zinc-200 bg-white";
const selectClass =
  "rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800";
const tableWrap = "overflow-x-auto rounded-[12px] border-[0.5px] border-zinc-200 bg-white";
const thClass =
  "px-3 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500";
const tdClass = "px-3 py-3 text-sm text-zinc-800";

function defaultFilters(): DeliveryFiltersInput {
  return { tutor: "all", rangeId: "30d", classType: "all" };
}

function formatDelta(delta: number | null): string {
  if (delta == null) return "vs prior period —";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} vs prior period`;
}

function formatScore(value: number | null, suffix = ""): string {
  if (value == null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function RatingCard({
  label,
  metric,
}: {
  label: string;
  metric: DeliveryRatingMetric;
}) {
  return (
    <div className={`${chrome} px-4 py-4`}>
      <p className="text-[13px] font-medium text-zinc-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">
        {formatScore(metric.current)}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{formatDelta(metric.delta)}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{metric.sampleSize} responses</p>
    </div>
  );
}

function OpsCard({ title, metric }: { title: string; metric: DeliveryOpsMetric }) {
  return (
    <div className={`${chrome} px-4 py-4`}>
      <p className="text-[13px] font-medium text-zinc-600">{title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">
        {formatScore(metric.overall, "%")}
      </p>
      <p className="mt-1 text-xs text-zinc-400">{metric.sampleSize} records</p>
      <ul className="mt-3 space-y-1">
        {metric.byClassType.map((row) => (
          <li key={row.classType} className="flex justify-between text-xs text-zinc-600">
            <span>{row.label}</span>
            <span className="tabular-nums">
              {formatScore(row.value, "%")}
              <span className="ml-1 text-zinc-400">({row.sampleSize})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminDeliverySection() {
  const [filters, setFilters] = useState<DeliveryFiltersInput>(defaultFilters);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [snapshot, setSnapshot] = useState<DeliverySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionedFilter, setActionedFilter] = useState("all");
  const [reviewTutor, setReviewTutor] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(next = filters) {
    setLoading(true);
    void fetchDeliveryDashboard(next).then((result) => {
      setSnapshot(result);
      setLoading(false);
    });
  }

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(partial: Partial<DeliveryFiltersInput>) {
    const next = { ...filters, ...partial };
    if (partial.rangeId === "custom") {
      next.customFrom = customFrom;
      next.customTo = customTo;
    }
    setFilters(next);
    load(next);
  }

  const reviewRows = useMemo(() => {
    const rows = snapshot?.toReview ?? [];
    return rows.filter((row) => {
      if (reviewTutor !== "all" && row.tutor !== reviewTutor) return false;
      if (actionedFilter === "all") return true;
      if (actionedFilter === "unset") return !row.actioned;
      return row.actioned === actionedFilter;
    });
  }, [snapshot, reviewTutor, actionedFilter]);

  async function onTwoWay(
    id: string,
    field: "actioned" | "video_testimonial_recorded",
    value: string
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateFeedbackTwoWayField({ id, field, value });
      setMessage(result.error ?? result.success ?? null);
      if (!result.error) load(filters);
    });
  }

  return (
    <div className="space-y-6">
      <div className={`${chrome} px-4 py-3`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Tutor
            <select
              className={`${selectClass} mt-1 block`}
              value={filters.tutor}
              onChange={(event) =>
                applyFilters({ tutor: event.target.value as DeliveryTutorName | "all" })
              }
            >
              <option value="all">All</option>
              {DELIVERY_TUTORS.map((tutor) => (
                <option key={tutor} value={tutor}>
                  {tutor}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Class type
            <select
              className={`${selectClass} mt-1 block`}
              value={filters.classType}
              onChange={(event) =>
                applyFilters({ classType: event.target.value as DeliveryClassTypeId | "all" })
              }
            >
              <option value="all">All</option>
              {DELIVERY_CLASS_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Date range
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DELIVERY_RANGE_PRESETS.map((preset) => (
                <AdminFilterPill
                  key={preset.id}
                  label={preset.label}
                  active={filters.rangeId === preset.id}
                  onClick={() => applyFilters({ rangeId: preset.id as DeliveryRangeId })}
                />
              ))}
              <AdminFilterPill
                label="Custom"
                active={filters.rangeId === "custom"}
                onClick={() => applyFilters({ rangeId: "custom" })}
              />
            </div>
          </div>
          {filters.rangeId === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className={selectClass}
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className={selectClass}
              />
              <button
                type="button"
                className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => applyFilters({ rangeId: "custom" })}
              >
                Apply
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="ml-auto rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await syncFeedbackResponsesNow();
                setMessage(result.error ?? result.success ?? null);
                load(filters);
              });
            }}
          >
            Sync Notion now
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {snapshot?.rangeLabel ? `${snapshot.rangeLabel} · ` : null}
          {snapshot?.feedbackRowCount ?? 0} feedback rows in range
          {loading ? " · Loading…" : null}
        </p>
      </div>

      {snapshot?.error ? (
        <p className="rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {snapshot.error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-zinc-600">{message}</p> : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Feedback overview
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <RatingCard label="Learning relevance" metric={snapshot?.ratings.learningRelevance ?? { current: null, previous: null, delta: null, sampleSize: 0 }} />
          <RatingCard label="Confidence" metric={snapshot?.ratings.confidence ?? { current: null, previous: null, delta: null, sampleSize: 0 }} />
          <RatingCard label="Tutor effectiveness" metric={snapshot?.ratings.tutorEffectiveness ?? { current: null, previous: null, delta: null, sampleSize: 0 }} />
        </div>
        <div className={`${chrome} mt-2 px-3 py-3`}>
          <DeliveryRatingsChart points={snapshot?.chart ?? []} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Homework, quiz and attendance
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <OpsCard title="Homework completion" metric={snapshot?.homework ?? { overall: null, sampleSize: 0, byClassType: [] }} />
          <OpsCard title="Quiz score" metric={snapshot?.quiz ?? { overall: null, sampleSize: 0, byClassType: [] }} />
          <OpsCard title="Attendance" metric={snapshot?.attendance ?? { overall: null, sampleSize: 0, byClassType: [] }} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          At-risk students
        </h2>
        <div className="grid gap-2 lg:grid-cols-2">
          <AtRiskTable title="Stopped attending" rows={snapshot?.stoppedAttending ?? []} empty="No students with 2+ consecutive missed Kidda Class sessions." />
          <AtRiskTable title="No scheduled classes" rows={snapshot?.noScheduledClasses ?? []} empty="Everyone with course access has a future session." />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Onboarding and offboarding
        </h2>
        <p className="mb-2 text-xs text-zinc-500">{snapshot?.pendingOffboardingNote}</p>
        <div className="grid gap-2 lg:grid-cols-2">
          <div className={tableWrap}>
            <p className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900">
              Pending offboarding ({snapshot?.pendingOffboarding.length ?? 0})
            </p>
            <SimplePeopleTable
              rows={(snapshot?.pendingOffboarding ?? []).map((row) => ({
                name: row.name,
                tutor: row.tutor,
                detail: `${row.packageRunName} · ${row.statusLabel}`,
                extra: row.classTypeLabel,
              }))}
              empty="None with Classes completed."
            />
          </div>
          <div className={tableWrap}>
            <p className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900">
              Testimonial pending ({snapshot?.testimonials.length ?? 0})
            </p>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/80">
                <tr>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Tutor</th>
                  <th className={thClass}>Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(snapshot?.testimonials ?? []).length === 0 ? (
                  <tr>
                    <td className={`${tdClass} text-zinc-500`} colSpan={3}>
                      No Lesson 12 testimonials waiting.
                    </td>
                  </tr>
                ) : (
                  (snapshot?.testimonials ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className={tdClass}>
                        <p className="font-medium">{row.fullName}</p>
                        <p className="text-xs text-zinc-500">{row.email}</p>
                      </td>
                      <td className={tdClass}>{row.tutor ?? "—"}</td>
                      <td className={tdClass}>
                        <select
                          className={selectClass}
                          value={row.videoTestimonialRecorded ?? ""}
                          disabled={pending}
                          onChange={(event) =>
                            onTwoWay(row.id, "video_testimonial_recorded", event.target.value)
                          }
                        >
                          <option value="">Select…</option>
                          {(snapshot?.videoTestimonialRecordedStatuses ?? []).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Feedback to review
          </h2>
          <div className="flex flex-wrap gap-2">
            <select
              className={selectClass}
              value={reviewTutor}
              onChange={(event) => setReviewTutor(event.target.value)}
            >
              <option value="all">All tutors</option>
              {DELIVERY_TUTORS.map((tutor) => (
                <option key={tutor} value={tutor}>
                  {tutor}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={actionedFilter}
              onChange={(event) => setActionedFilter(event.target.value)}
            >
              <option value="all">All Actioned</option>
              <option value="unset">Unset</option>
              {(snapshot?.actionedStatuses ?? []).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          Critical Feedback is true, or Overall Score below {snapshot?.belowParThreshold ?? 3.5}/5
          (default — flag for approval).
        </p>
        <div className={tableWrap}>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80">
              <tr>
                <th className={thClass}>Student</th>
                <th className={thClass}>Tutor</th>
                <th className={thClass}>Scores</th>
                <th className={thClass}>Why</th>
                <th className={thClass}>Actioned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {reviewRows.length === 0 ? (
                <tr>
                  <td className={`${tdClass} text-zinc-500`} colSpan={5}>
                    Nothing to review in this range.
                  </td>
                </tr>
              ) : (
                reviewRows.map((row) => (
                  <tr key={row.id}>
                    <td className={tdClass}>
                      <p className="font-medium">{row.fullName}</p>
                      <p className="text-xs text-zinc-500">
                        {row.lesson} · {formatDate(row.feedbackDate)}
                      </p>
                    </td>
                    <td className={tdClass}>{row.tutor ?? "—"}</td>
                    <td className={`${tdClass} tabular-nums text-xs`}>
                      Rel {formatScore(row.learningRelevance)} · Conf {formatScore(row.confidence)} ·
                      Tut {formatScore(row.tutorEffectiveness)} · Overall{" "}
                      {formatScore(row.overallScore)}
                    </td>
                    <td className={tdClass}>
                      {row.criticalFeedback ? "Critical" : null}
                      {row.criticalFeedback && row.belowPar ? " · " : null}
                      {row.belowPar ? "Below par" : null}
                    </td>
                    <td className={tdClass}>
                      <select
                        className={selectClass}
                        value={row.actioned ?? ""}
                        disabled={pending}
                        onChange={(event) => onTwoWay(row.id, "actioned", event.target.value)}
                      >
                        <option value="">Select…</option>
                        {(snapshot?.actionedStatuses ?? []).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Per tutor
        </h2>
        <div className={tableWrap}>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80">
              <tr>
                <th className={thClass}>Tutor</th>
                <th className={thClass}>Learning relevance</th>
                <th className={thClass}>Confidence</th>
                <th className={thClass}>Tutor effectiveness</th>
                <th className={thClass}>Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(snapshot?.perTutor ?? []).map((row) => (
                <tr key={row.tutor}>
                  <td className={`${tdClass} font-medium`}>{row.tutor}</td>
                  <td className={`${tdClass} tabular-nums`}>{formatScore(row.learningRelevance)}</td>
                  <td className={`${tdClass} tabular-nums`}>{formatScore(row.confidence)}</td>
                  <td className={`${tdClass} tabular-nums`}>{formatScore(row.tutorEffectiveness)}</td>
                  <td className={`${tdClass} tabular-nums`}>{formatScore(row.attendancePercent, "%")}</td>
                </tr>
              ))}
              {snapshot?.teamAverage ? (
                <tr className="bg-zinc-50/80">
                  <td className={`${tdClass} font-semibold`}>{snapshot.teamAverage.tutor}</td>
                  <td className={`${tdClass} tabular-nums font-semibold`}>
                    {formatScore(snapshot.teamAverage.learningRelevance)}
                  </td>
                  <td className={`${tdClass} tabular-nums font-semibold`}>
                    {formatScore(snapshot.teamAverage.confidence)}
                  </td>
                  <td className={`${tdClass} tabular-nums font-semibold`}>
                    {formatScore(snapshot.teamAverage.tutorEffectiveness)}
                  </td>
                  <td className={`${tdClass} tabular-nums font-semibold`}>
                    {formatScore(snapshot.teamAverage.attendancePercent, "%")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AtRiskTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{
    userId: string;
    name: string;
    tutor: string | null;
    classTypeLabel: string;
    cohortOrCourse: string;
    daysSinceLastActivity: number | null;
    detail: string;
  }>;
  empty: string;
}) {
  return (
    <div className={tableWrap}>
      <p className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900">
        {title} ({rows.length})
      </p>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-100 bg-zinc-50/80">
          <tr>
            <th className={thClass}>Student</th>
            <th className={thClass}>Tutor</th>
            <th className={thClass}>Class</th>
            <th className={thClass}>Days</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.length === 0 ? (
            <tr>
              <td className={`${tdClass} text-zinc-500`} colSpan={4}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={`${title}-${row.userId}`}>
                <td className={tdClass}>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-zinc-500">{row.detail}</p>
                </td>
                <td className={tdClass}>{row.tutor ?? "—"}</td>
                <td className={tdClass}>
                  {row.classTypeLabel}
                  <p className="text-xs text-zinc-500">{row.cohortOrCourse}</p>
                </td>
                <td className={`${tdClass} tabular-nums`}>
                  {row.daysSinceLastActivity ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SimplePeopleTable({
  rows,
  empty,
}: {
  rows: Array<{ name: string; tutor: string | null; detail: string; extra: string }>;
  empty: string;
}) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="border-b border-zinc-100 bg-zinc-50/80">
        <tr>
          <th className={thClass}>Student</th>
          <th className={thClass}>Tutor</th>
          <th className={thClass}>Detail</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {rows.length === 0 ? (
          <tr>
            <td className={`${tdClass} text-zinc-500`} colSpan={3}>
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={`${row.name}-${index}`}>
              <td className={`${tdClass} font-medium`}>{row.name}</td>
              <td className={tdClass}>{row.tutor ?? "—"}</td>
              <td className={tdClass}>
                {row.detail}
                <p className="text-xs text-zinc-500">{row.extra}</p>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
