"use client";

import {
  addPronunciationRuleAndRegenerateAction,
  approveContentAudioAction,
  loadAudioReviewQueue,
  loadContentAudioAsset,
  loadPronunciationRulesAction,
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
import {
  GenerateControl,
  PronunciationFixForm,
  VariationPicker,
} from "@/app/admin/content/components/audio-review-controls";
import type { PronunciationRule } from "@/lib/elevenlabs/pronunciation-dictionary";
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

function PronunciationRulesSection({ refreshKey }: { refreshKey: number }) {
  const [rules, setRules] = useState<PronunciationRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const result = await loadPronunciationRulesAction();
    if (result.error) {
      setError(result.error);
      setRules([]);
    } else {
      setError(null);
      setRules(result.rules ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, [refreshKey]);

  return (
    <section className={`${ui.cardBordered} space-y-3`}>
      <div>
        <h3 className="font-semibold text-zinc-900">Pronunciation dictionary</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Rules are synced to ElevenLabs and attached to every generation. Requires API key with
          Pronunciation Dictionaries Read + Write access.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading rules…</p>
      ) : error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-zinc-500">No rules yet — add one when rejecting a clip below.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white text-sm">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
              <div>
                <span className="font-medium text-zinc-900">{rule.source_word}</span>
                <span className="mx-2 text-zinc-400">→</span>
                <span className="text-zinc-700">{rule.replacement}</span>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {rule.rule_type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type ReviewResolution =
  | { action: "approved" }
  | { action: "rejected" }
  | { action: "regenerated" }
  | { action: "pronunciation_rule" };

function ReviewCard({
  item,
  onResolved,
}: {
  item: AudioReviewItem;
  onResolved: (result: ReviewResolution) => void;
}) {
  const [script, setScript] = useState(item.scriptText ?? "");
  const [notes, setNotes] = useState(item.reviewNotes ?? "");
  const [mispronouncedWord, setMispronouncedWord] = useState("");
  const [correction, setCorrection] = useState("");
  const [ruleType, setRuleType] = useState<"alias" | "phoneme">("alias");
  const [showPronunciationFix, setShowPronunciationFix] = useState(false);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(
    item.pendingVariations[0]?.id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setScript(item.scriptText ?? "");
    setNotes(item.reviewNotes ?? "");
    setSelectedVariationId(item.pendingVariations[0]?.id ?? null);
  }, [
    item.contentId,
    item.contentType,
    item.scriptText,
    item.reviewNotes,
    item.pendingVariations,
    item.status,
  ]);

  const history = item.generations.filter((g) => g.status !== "pending_review");
  const hasMultipleVariations = item.pendingVariations.length > 1;
  const singleVariation = item.pendingVariations.length === 1 ? item.pendingVariations[0] : null;

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
      const result = await approveContentAudioAction(
        item.contentType,
        item.contentId,
        hasMultipleVariations ? selectedVariationId ?? undefined : undefined
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onResolved({ action: "approved" });
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
      onResolved({ action: "rejected" });
    });
  }

  function regenerate(variationCount = 1) {
    setError(null);
    startTransition(async () => {
      const result = await regenerateContentAudioAction(
        item.contentType,
        item.contentId,
        script,
        { variationCount }
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onResolved({ action: "regenerated" });
    });
  }

  function savePronunciationAndRegenerate() {
    setError(null);
    startTransition(async () => {
      const result = await addPronunciationRuleAndRegenerateAction({
        contentType: item.contentType,
        contentId: item.contentId,
        script,
        sourceWord: mispronouncedWord,
        ruleType,
        replacement: correction,
        reviewNotes: notes || undefined,
        variationCount: 1,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onResolved({ action: "pronunciation_rule" });
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
          {singleVariation ? (
            <p className="mt-2 text-xs text-zinc-500">Voice: {singleVariation.voiceLabel}</p>
          ) : null}
        </div>
      </div>

      {hasMultipleVariations ? (
        <>
          <p className={`${labelClass} mt-4`}>Pick a variation to approve</p>
          <div className="mt-4">
            <VariationPicker
              variations={item.pendingVariations}
              selectedId={selectedVariationId}
              onSelect={setSelectedVariationId}
            />
          </div>
        </>
      ) : singleVariation ? (
        <div className="mt-4">
          <p className={labelClass}>Generated clip</p>
          <audio
            controls
            preload="metadata"
            className="mt-1 w-full"
            src={singleVariation.pendingAudioUrl}
          />
        </div>
      ) : item.pendingAudioUrl ? (
        <div className="mt-4">
          <p className={labelClass}>Generated clip</p>
          <audio controls preload="metadata" className="mt-1 w-full" src={item.pendingAudioUrl} />
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
              placeholder="e.g. Mispronounces ਪਾਣੀ — add alias or IPA correction below"
            />
          </div>

          <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
            <button
              type="button"
              onClick={() => setShowPronunciationFix((open) => !open)}
              className="text-sm font-semibold text-violet-800"
            >
              {showPronunciationFix ? "Hide" : "Add"} pronunciation fix &amp; regenerate
            </button>
            {showPronunciationFix ? (
              <PronunciationFixForm
                mispronouncedWord={mispronouncedWord}
                correction={correction}
                ruleType={ruleType}
                pending={pending}
                disabled={!script.trim()}
                onWordChange={setMispronouncedWord}
                onCorrectionChange={setCorrection}
                onRuleTypeChange={setRuleType}
                onSubmit={savePronunciationAndRegenerate}
              />
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || (hasMultipleVariations && !selectedVariationId)}
              onClick={approve}
              className={buttonClass}
            >
              {pending ? "Saving…" : hasMultipleVariations ? "Approve selected take" : "Approve"}
            </button>
            <button
              type="button"
              disabled={pending || !notes.trim()}
              onClick={reject}
              className={secondaryButtonClass}
            >
              Needs changes
            </button>
            <GenerateControl
              label="Regenerate"
              pending={pending}
              disabled={!script.trim()}
              onGenerate={regenerate}
            />
          </div>
        </>
      ) : (
        <div className="mt-4">
          <GenerateControl
            label="Regenerate from script"
            pending={pending}
            disabled={!script.trim()}
            onGenerate={regenerate}
          />
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
                    {gen.status === "approved" ? "Approved" : "Rejected"} · {formatWhen(gen.created_at)}
                    {gen.voice_id ? ` · ${gen.voice_id.slice(0, 8)}…` : ""}
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
  const [rulesRefreshKey, setRulesRefreshKey] = useState(0);

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

  function handleResolved(item: AudioReviewItem, result: ReviewResolution) {
    if (result.action === "approved") {
      setItems((current) =>
        current.filter(
          (entry) =>
            !(entry.contentType === item.contentType && entry.contentId === item.contentId)
        )
      );
      return;
    }

    if (result.action === "pronunciation_rule") {
      setRulesRefreshKey((key) => key + 1);
    }

    void patchReviewItem(item.contentType, item.contentId);
  }

  async function patchReviewItem(contentType: AudioContentType, contentId: string) {
    const result = await loadContentAudioAsset(contentType, contentId);
    if (result.error || !result.asset) return;

    const asset = result.asset;
    setItems((current) =>
      current.map((entry) =>
        entry.contentType === contentType && entry.contentId === contentId
          ? {
              ...entry,
              scriptText: asset.scriptText,
              status: asset.status,
              reviewNotes: asset.reviewNotes,
              pendingVariations: asset.pendingVariations,
              pendingAudioUrl: asset.pendingAudioUrl,
              approvedAudioUrl: asset.approvedAudioUrl,
            }
          : entry
      )
    );
  }

  useEffect(() => {
    void refresh();
  }, []);

  const typeLabels = [...new Set(items.map((item) => item.contentTypeLabel))].sort();
  const filtered =
    typeFilter === "all" ? items : items.filter((item) => item.contentTypeLabel === typeFilter);

  const pending = filtered.filter((i) => i.status === "pending_review");
  const needsChanges = filtered.filter((i) => i.status === "needs_changes");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Audio review queue</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Listen to generated clips from all content types before they go live. Pipeline uses
          Eleven v3 with dashboard-aligned settings.
        </p>
      </div>

      <PronunciationRulesSection refreshKey={rulesRefreshKey} />

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
                    onResolved={(result) => handleResolved(item, result)}
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
                    onResolved={(result) => handleResolved(item, result)}
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

export const LessonAudioReviewTab = AudioReviewTab;
