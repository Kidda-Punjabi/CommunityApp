"use client";

import {
  generateContentAudioAction,
  loadContentAudioAsset,
  type AudioActionResult,
} from "@/app/admin/content/audio-actions";
import {
  audioAssetStatusBadgeClass,
  AUDIO_ASSET_STATUS_LABELS,
  AUDIO_CONTENT_TYPE_LABELS,
  type AudioAssetStatus,
  type AudioContentType,
} from "@/lib/audio/types";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { labelClass, secondaryButtonClass } from "./ui";

type AudioPanelProps = {
  contentType: AudioContentType;
  contentId: string;
  /** Initial script when no audio asset exists yet */
  defaultScript?: string | null;
  scriptHint?: string;
};

export function AudioPanel({
  contentType,
  contentId,
  defaultScript = "",
  scriptHint = "Enter the Punjabi text to be read aloud (Gurmukhi).",
}: AudioPanelProps) {
  const router = useRouter();
  const [script, setScript] = useState(defaultScript ?? "");
  const [status, setStatus] = useState<AudioAssetStatus>("none");
  const [approvedUrl, setApprovedUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<AudioActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setScript(defaultScript ?? "");
  }, [defaultScript]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await loadContentAudioAsset(contentType, contentId);
      if (cancelled) return;

      if (result.asset) {
        setStatus(result.asset.status);
        setApprovedUrl(result.asset.approvedAudioUrl);
        if (result.asset.scriptText) {
          setScript(result.asset.scriptText);
        }
      } else {
        setStatus("none");
        setApprovedUrl(null);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [contentType, contentId, defaultScript]);

  function runGenerate() {
    setMessage(null);
    startTransition(async () => {
      const result = await generateContentAudioAction(
        contentType,
        contentId,
        script.trim() || null
      );
      setMessage(result);
      if (!result.error) {
        setStatus("pending_review");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">
          Generated audio ({AUDIO_CONTENT_TYPE_LABELS[contentType]})
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${audioAssetStatusBadgeClass(status)}`}
        >
          {AUDIO_ASSET_STATUS_LABELS[status]}
        </span>
      </div>

      <p className="text-xs text-zinc-500">{scriptHint}</p>

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
      </div>

      {approvedUrl && status === "approved" ? (
        <p className="text-xs text-emerald-700">
          Live audio is approved.{" "}
          <a href={approvedUrl} target="_blank" rel="noreferrer" className="underline">
            Listen
          </a>
        </p>
      ) : null}

      {status === "pending_review" ? (
        <p className="text-xs text-amber-800">
          A clip is waiting in the Audio review queue — approve it there before generating again.
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending || loading || status === "pending_review"}
        onClick={runGenerate}
        className={secondaryButtonClass}
      >
        {pending ? "Generating audio…" : "Generate audio"}
      </button>

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
