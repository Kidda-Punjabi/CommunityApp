"use client";

import {
  approveContentAudioAction,
  loadAudioReviewQueue,
  regenerateContentAudioAction,
  rejectContentAudioAction,
  saveContentAudioScriptAction,
  type AudioReviewItem,
} from "@/app/admin/content/audio-actions";
import { formatAudioReviewTitle, getPublicAudioUrl } from "@/lib/audio/generate-audio";
import {
  audioAssetStatusBadgeClass,
  AUDIO_ASSET_STATUS_LABELS,
  type AudioContentType,
} from "@/lib/audio/types";
import { ui } from "@/lib/ui/styles";
import { useEffect, useState, useTransition } from "react";
import { buttonClass, inputClass, labelClass, secondaryButtonClass } from "./ui";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function generationAudioUrl(contentType: AudioContentType, storagePath: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return getPublicAudioUrl(supabaseUrl, contentType, storagePath);
}

function ReviewCard({
  item,
  onUpdated,
}: {
  item: AudioReviewItem;
  onUpdated: () => void;
}) {
  const [script, setScript] = useState(item.scriptText ?? "");
  const [notes, setNotes] = useState(item.reviewNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const history = item.generations.filter((g) => g.status !== "pending_review");
  const audioSrc = item.pendingAudioUrl;
  const reviewTitle = formatAudioReviewTitle({
    contentType: item.contentType,
    contentId: item.contentId,
    title: item.title,
    subtitle: item.subtitle,
    defaultScript: item.scriptText ?? "",
  });

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approveContentAudioAction(item.contentType, item.contentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      onUpdated();
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectContentAudioAction(item.contentType, item.contentId, notes);
      if (result.error) {
        setError(result.error);
        return;
      }
      onUpdated();
    });
  }

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateContentAudioAction(
        item.contentType,
        item.contentId,
        script
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onUpdated();
    });
  }

  function saveScriptOnly() {
    setError(null);
    startTransition(async () => {
      const result = await saveContentAudioScriptAction(
        item.contentType,
        item.contentId,
        script
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onUpdated();
    });
  }

  return (
    <li className={ui.cardBordered}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
            {item.contentTypeLabel}
          </span>
          <p className="mt-2 font-semibold text-zinc-900">{reviewTitle}</p>
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${audioAssetStatusBadgeClass(item.status)}`}
          >
            {AUDIO_ASSET_STATUS_LABELS[item.status]}
          </span>
        </div>
      </div>

      {audioSrc ? (
        <div className="mt-4">
          <p className={labelClass}>Generated clip</p>
          <audio controls preload="metadata" className="mt-1 w-full" src={audioSrc} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          No pending clip — edit the script and regenerate.
        </p>
      )}

      <div className="mt-4">
        <label className={labelClass}>Audio script</label>
        <textarea
          value={script}
          onChange={(event) => setScript(event.target.value)}
          rows={4}
          dir="auto"
          className={`${inputClass} mt-1 font-normal`}
        />
        <button
          type="button"
          disabled={pending}
          onClick={saveScriptOnly}
          className={`${secondaryButtonClass} mt-2`}
        >
          Save script
        </button>
      </div>

      {item.status === "pending_review" ? (
        <>
          <div className="mt-4">
            <label className={labelClass}>Review notes (required for Needs changes)</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className={`${inputClass} mt-1 font-normal`}
              placeholder="e.g. Mispronounces ਪਾਣੀ — add phonetic hint or punctuation for pauses"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={approve} className={buttonClass}>
              {pending ? "Saving…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={pending || !notes.trim()}
              onClick={reject}
              className={secondaryButtonClass}
            >
              Needs changes
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled={pending || !script.trim()}
            onClick={regenerate}
            className={buttonClass}
          >
            {pending ? "Regenerating…" : "Regenerate from script"}
          </button>
        </div>
      )}

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      {history.length > 0 ? (
        <details className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-zinc-600">
            Previous attempts ({history.length})
          </summary>
          <ul className="mt-3 space-y-3">
            {history.map((gen) => {
              const clipUrl = generationAudioUrl(item.contentType, gen.storage_path);

              return (
                <li key={gen.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
                  <p className="font-medium text-zinc-800">
                    {gen.status === "approved" ? "Approved" : "Rejected"} ·{" "}
                    {formatWhen(gen.created_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600">{gen.script_text}</p>
                  {gen.review_notes ? (
                    <p className="mt-2 text-rose-700">
                      <span className="font-medium">Notes:</span> {gen.review_notes}
                    </p>
                  ) : null}
                  {clipUrl ? (
                    <audio controls preload="none" className="mt-2 w-full" src={clipUrl} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

export function AudioReviewTab() {
  const [items, setItems] = useState<AudioReviewItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  async function refresh() {
    setLoading(true);
    const result = await loadAudioReviewQueue();
    if (result.error) {
      setLoadError(result.error);
      setItems([]);
    } else {
      setLoadError(null);
      setItems(result.items ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const typeLabels = [...new Set(items.map((item) => item.contentTypeLabel))].sort();
  const filtered =
    typeFilter === "all"
      ? items
      : items.filter((item) => item.contentTypeLabel === typeFilter);

  const pending = filtered.filter((i) => i.status === "pending_review");
  const needsChanges = filtered.filter((i) => i.status === "needs_changes");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Audio review queue</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Listen to generated clips from all content types before they go live. Nothing reaches
          learners until you approve it here.
        </p>
      </div>

      {typeLabels.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={typeFilter === "all"}
            label={`All (${items.length})`}
            onClick={() => setTypeFilter("all")}
          />
          {typeLabels.map((label) => (
            <FilterChip
              key={label}
              active={typeFilter === label}
              label={`${label} (${items.filter((i) => i.contentTypeLabel === label).length})`}
              onClick={() => setTypeFilter(label)}
            />
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading queue…</p>
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{loadError}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No content waiting for audio review.</p>
      ) : (
        <>
          {pending.length > 0 ? (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-800">
                Pending review ({pending.length})
              </h3>
              <ul className="space-y-4">
                {pending.map((item) => (
                  <ReviewCard
                    key={`${item.contentType}-${item.contentId}`}
                    item={item}
                    onUpdated={() => void refresh()}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {needsChanges.length > 0 ? (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-700">
                Needs changes ({needsChanges.length})
              </h3>
              <ul className="space-y-4">
                {needsChanges.map((item) => (
                  <ReviewCard
                    key={`${item.contentType}-${item.contentId}`}
                    item={item}
                    onUpdated={() => void refresh()}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
        active
          ? "bg-violet-600 text-white"
          : "border border-zinc-200 bg-white text-zinc-700 hover:border-violet-200"
      }`}
    >
      {label}
    </button>
  );
}

/** @deprecated Use AudioReviewTab */
export const LessonAudioReviewTab = AudioReviewTab;
