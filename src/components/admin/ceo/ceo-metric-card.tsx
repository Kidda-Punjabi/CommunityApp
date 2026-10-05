"use client";

import { updateCeoTarget } from "@/app/admin/ceo/actions";
import { ceoStatusLabel, formatCeoTarget, formatCeoValue, inputToTarget, targetToInput } from "@/lib/admin/ceo/format";
import type { CeoMetric, CeoSnapshot, CeoStatus } from "@/lib/admin/ceo/types";
import { useState } from "react";

const PILL: Record<CeoStatus, string> = {
  on_target: "bg-emerald-50 text-emerald-800",
  watch: "bg-amber-50 text-amber-800",
  off_target: "bg-red-50 text-red-800",
  needs_target: "bg-zinc-100 text-zinc-700",
  not_connected: "bg-zinc-100 text-zinc-500",
};

type CeoMetricCardProps = {
  metric: CeoMetric;
  onSnapshot: (snapshot: CeoSnapshot) => void;
};

export function CeoMetricCard({ metric, onSnapshot }: CeoMetricCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(targetToInput(metric));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const target = inputToTarget(metric.format, draft);
      const result = await updateCeoTarget(metric.id, target);
      if (result.error || !result.snapshot) {
        setError(result.error ?? "Could not save the target.");
        return;
      }
      onSnapshot(result.snapshot);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enter a number.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="flex min-h-[168px] flex-col rounded-[12px] border-[0.5px] border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-600">{metric.label}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[metric.status]}`}>
          {ceoStatusLabel(metric.status)}
        </span>
      </div>
      <p className="mt-3 font-heading text-[28px] font-semibold leading-none text-zinc-900">
        {formatCeoValue(metric.value, metric.format)}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">{formatCeoTarget(metric)}</p>
      {editing ? (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            inputMode="decimal"
            aria-label={`${metric.label} target`}
            className="w-24 rounded-md border border-zinc-200 px-2 py-1 text-sm"
          />
          <button type="submit" disabled={saving} className="text-sm font-semibold text-violet-700">
            {saving ? "Saving" : "Save"}
          </button>
          <button
            type="button"
            className="text-sm text-zinc-500"
            onClick={() => {
              setEditing(false);
              setDraft(targetToInput(metric));
              setError(null);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="mt-auto pt-3 text-left text-xs font-semibold text-violet-700"
          onClick={() => {
            setDraft(targetToInput(metric));
            setEditing(true);
          }}
        >
          Edit target
        </button>
      )}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {metric.detail ? <p className="mt-2 text-xs leading-relaxed text-zinc-500">{metric.detail}</p> : null}
    </article>
  );
}

export function CeoMetricGrid({
  metrics,
  onSnapshot,
}: {
  metrics: CeoMetric[];
  onSnapshot: (snapshot: CeoSnapshot) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {metrics.map((metric) => (
        <CeoMetricCard key={metric.id} metric={metric} onSnapshot={onSnapshot} />
      ))}
    </div>
  );
}
