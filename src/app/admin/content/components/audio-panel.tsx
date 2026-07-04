"use client";

import {
  addPronunciationRuleAndRegenerateAction,
  approveContentAudioAction,
  generateContentAudioAction,
  loadContentAudioAsset,
  regenerateContentAudioAction,
  rejectContentAudioAction,
  saveContentAudioScriptAction,
  type AudioActionResult,
  type PendingVariation,
} from "@/app/admin/content/audio-actions";
import {
  GenerateControl,
  PronunciationFixForm,
  VariationPicker,
} from "@/app/admin/content/components/audio-review-controls";
import {
  DEFAULT_VETTED_VOICE_ID,
  VETTED_PUNJABI_VOICES,
  getVettedVoice,
} from "@/lib/elevenlabs/constants";
import {
  audioAssetStatusBadgeClass,
  AUDIO_ASSET_STATUS_LABELS,
  type AudioAssetStatus,
  type AudioContentType,
} from "@/lib/audio/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { buttonClass, labelClass, secondaryButtonClass } from "./ui";

type AudioPanelProps = {
  contentType: AudioContentType;
  contentId: string;
  defaultScript?: string | null;
  scriptHint?: string;
  onUpdated?: () => void;
  /** Pre-select voice when generating (e.g. character default). */
  defaultVoiceId?: string | null;
};

function voiceLabelForId(voiceId: string | null): string | null {
  if (!voiceId) return null;
  return getVettedVoice(voiceId)?.label ?? voiceId;
}

export function AudioPanel({
  contentType,
  contentId,
  defaultScript = "",
  scriptHint = "Enter the Punjabi text to be read aloud (Gurmukhi).",
  onUpdated,
  defaultVoiceId,
}: AudioPanelProps) {
  const router = useRouter();
  const [script, setScript] = useState(defaultScript ?? "");
  const [voiceId, setVoiceId] = useState(DEFAULT_VETTED_VOICE_ID);
  const [status, setStatus] = useState<AudioAssetStatus>("none");
  const [approvedUrl, setApprovedUrl] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [pendingVariations, setPendingVariations] = useState<PendingVariation[]>([]);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [storedVoiceLabel, setStoredVoiceLabel] = useState<string | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [showRejectFlow, setShowRejectFlow] = useState(false);
  const [showPronunciationFix, setShowPronunciationFix] = useState(false);
  const [mispronouncedWord, setMispronouncedWord] = useState("");
  const [correction, setCorrection] = useState("");
  const [ruleType, setRuleType] = useState<"alias" | "phoneme">("alias");
  const [message, setMessage] = useState<AudioActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loadContentAudioAsset(contentType, contentId);

    if (result.asset) {
      const asset = result.asset;
      setStatus(asset.status);
      setApprovedUrl(asset.approvedAudioUrl);
      setReviewNotes(asset.reviewNotes ?? "");
      setPendingVariations(asset.pendingVariations);
      setPendingAudioUrl(asset.pendingAudioUrl);
      setStoredVoiceLabel(asset.activeVoiceLabel);
      setSelectedVariationId(asset.pendingVariations[0]?.id ?? null);

      if (asset.scriptText) {
        setScript(asset.scriptText);
      } else if (defaultScript) {
        setScript(defaultScript);
      }

      if (asset.activeVoiceId) {
        setVoiceId(asset.activeVoiceId);
      } else if (defaultVoiceId) {
        setVoiceId(defaultVoiceId);
      }
    } else {
      setStatus("none");
      setApprovedUrl(null);
      setReviewNotes("");
      setPendingVariations([]);
      setPendingAudioUrl(null);
      setStoredVoiceLabel(null);
      setScript(defaultScript ?? "");
    }

    setLoading(false);
  }, [contentType, contentId, defaultScript, defaultVoiceId]);

  useEffect(() => {
    setScript(defaultScript ?? "");
  }, [defaultScript]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function afterAction(result: AudioActionResult) {
    setMessage(result);
    if (!result.error) {
      void reload();
      onUpdated?.();
      router.refresh();
    }
  }

  function runGenerate(variationCount = 1) {
    setMessage(null);
    startTransition(async () => {
      const trimmed = script.trim();
      const action =
        status === "none"
          ? generateContentAudioAction(contentType, contentId, {
              scriptOverride: trimmed || null,
              voiceId,
              variationCount,
            })
          : regenerateContentAudioAction(contentType, contentId, trimmed, {
              voiceId,
              variationCount,
            });

      afterAction(await action);
    });
  }

  function approve() {
    setMessage(null);
    startTransition(async () => {
      const hasMultiple = pendingVariations.length > 1;
      afterAction(
        await approveContentAudioAction(
          contentType,
          contentId,
          hasMultiple ? selectedVariationId ?? undefined : undefined
        )
      );
    });
  }

  function reject() {
    setMessage(null);
    startTransition(async () => {
      afterAction(await rejectContentAudioAction(contentType, contentId, reviewNotes));
      setShowRejectFlow(false);
    });
  }

  function saveScriptOnly() {
    setMessage(null);
    startTransition(async () => {
      afterAction(await saveContentAudioScriptAction(contentType, contentId, script));
    });
  }

  function savePronunciationAndRegenerate() {
    setMessage(null);
    startTransition(async () => {
      afterAction(
        await addPronunciationRuleAndRegenerateAction({
          contentType,
          contentId,
          script,
          sourceWord: mispronouncedWord,
          ruleType,
          replacement: correction,
          reviewNotes: reviewNotes || undefined,
          voiceId,
          variationCount: 1,
        })
      );
      setShowPronunciationFix(false);
      setShowRejectFlow(false);
    });
  }

  const hasMultipleVariations = pendingVariations.length > 1;
  const generateLabel =
    status === "none" ? "Generate audio" : status === "pending_review" ? "Regenerate" : "Regenerate";

  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">Generated audio</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${audioAssetStatusBadgeClass(status)}`}
        >
          {AUDIO_ASSET_STATUS_LABELS[status]}
        </span>
      </div>

      <p className="text-xs text-zinc-500">{scriptHint}</p>

      <div>
        <label className={labelClass}>
          Voice{storedVoiceLabel && status !== "none" ? ` — last used: ${storedVoiceLabel}` : ""}
        </label>
        <select
          value={voiceId}
          onChange={(event) => setVoiceId(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
        >
          {VETTED_PUNJABI_VOICES.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.label}
            </option>
          ))}
        </select>
        {storedVoiceLabel && voiceId !== pendingVariations[0]?.voiceId ? (
          <p className="mt-1 text-xs text-zinc-500">Change voice applies on next generate/regenerate.</p>
        ) : null}
      </div>

      {hasMultipleVariations ? (
        <div>
          <p className={labelClass}>Pick a variation to approve</p>
          <VariationPicker
            variations={pendingVariations}
            selectedId={selectedVariationId}
            onSelect={setSelectedVariationId}
          />
        </div>
      ) : pendingAudioUrl && status === "pending_review" ? (
        <div>
          <p className={labelClass}>Generated clip</p>
          <audio controls preload="metadata" className="mt-1 w-full" src={pendingAudioUrl} />
        </div>
      ) : approvedUrl && status === "approved" ? (
        <div>
          <p className={labelClass}>Approved clip</p>
          <audio controls preload="metadata" className="mt-1 w-full" src={approvedUrl} />
        </div>
      ) : null}

      <div>
        <label className={labelClass}>Audio script</label>
        <textarea
          value={script}
          onChange={(event) => setScript(event.target.value)}
          rows={4}
          dir="auto"
          className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          placeholder="ਪੰਜਾਬੀ ਪਾਠ ਇੱਥੇ ਲਿਖੋ…"
        />
        <button
          type="button"
          disabled={pending || loading || !script.trim()}
          onClick={saveScriptOnly}
          className={`${secondaryButtonClass} mt-2`}
        >
          Save script
        </button>
      </div>

      {status === "pending_review" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || loading || (hasMultipleVariations && !selectedVariationId)}
            onClick={approve}
            className={buttonClass}
          >
            {pending ? "Saving…" : hasMultipleVariations ? "Approve selected take" : "Approve"}
          </button>
          <button
            type="button"
            disabled={pending || loading}
            onClick={() => {
              setShowRejectFlow((open) => !open);
              setShowPronunciationFix(false);
            }}
            className={secondaryButtonClass}
          >
            Needs changes
          </button>
        </div>
      ) : null}

      {showRejectFlow || status === "needs_changes" ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
          <label className={labelClass}>Review notes</label>
          <textarea
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            placeholder="What needs fixing?"
          />
          {status === "needs_changes" || showRejectFlow ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {showRejectFlow && status === "pending_review" ? (
                <button
                  type="button"
                  disabled={pending || !reviewNotes.trim()}
                  onClick={reject}
                  className={secondaryButtonClass}
                >
                  Mark needs changes
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowPronunciationFix((open) => !open)}
                className="text-sm font-semibold text-violet-800"
              >
                {showPronunciationFix ? "Hide" : "Add"} pronunciation fix &amp; regenerate
              </button>
            </div>
          ) : null}
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
      ) : null}

      <GenerateControl
        label={generateLabel}
        pending={pending}
        disabled={loading || !script.trim()}
        onGenerate={runGenerate}
      />

      {message?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{message.error}</p>
      ) : null}
      {message?.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message.success}
        </p>
      ) : null}
    </div>
  );
}

/** Compact status badge for collapsed list rows. */
export function AudioStatusBadge({ status }: { status: AudioAssetStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${audioAssetStatusBadgeClass(status)}`}
    >
      {status === "none" ? "Not generated" : AUDIO_ASSET_STATUS_LABELS[status]}
    </span>
  );
}
