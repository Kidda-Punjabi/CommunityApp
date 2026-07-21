"use client";

import { BackLink } from "@/components/navigation/back-link";
import {
  photoCaptureInputClass,
  TranslatePrimaryButton,
} from "@/components/translate/translate-primary-button";
import { resizeImageForPhotoScan } from "@/lib/photo-translate/resize-image";
import { formatScansRemaining } from "@/lib/photo-translate/month-key";
import type { PhotoTranslateUsageSnapshot } from "@/lib/photo-translate/usage";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { useId, useRef, useState } from "react";

type ScanResult = {
  previewUrl: string;
  textDetected: boolean;
  fullTranslation: string | null;
  summary: string | null;
};

type ScanResponse = {
  text_detected?: boolean;
  full_translation?: string | null;
  summary?: string | null;
  scans_remaining_this_month?: number;
  scans_used_this_month?: number;
  resets_on?: string;
  message?: string;
  error?: string;
};

type PhotoTranslateSessionProps = {
  initialUsage: PhotoTranslateUsageSnapshot;
};

export function PhotoTranslateSession({ initialUsage }: PhotoTranslateSessionProps) {
  const captureInputId = useId();
  const [usage, setUsage] = useState(initialUsage);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (usage.scansRemaining <= 0) {
      setStatusMessage(
        `You've used all 25 scans for this month. Your allowance resets on ${usage.resetsOn}.`
      );
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);
    setResult(null);

    try {
      const compressed = await resizeImageForPhotoScan(file);
      const previewUrl = URL.createObjectURL(compressed);

      const formData = new FormData();
      formData.append("image", compressed, "photo.jpg");

      const response = await fetch("/api/photo-translate/scan", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ScanResponse;

      if (response.status === 429) {
        setUsage((current) => ({
          ...current,
          scansRemaining: 0,
          scansUsed: payload.scans_used_this_month ?? current.capScans,
        }));
        setStatusMessage(
          payload.message ??
            `You've used all 25 scans for this month. Resets on ${payload.resets_on ?? usage.resetsOn}.`
        );
        URL.revokeObjectURL(previewUrl);
        return;
      }

      if (!response.ok) {
        URL.revokeObjectURL(previewUrl);
        throw new Error(payload.error ?? payload.message ?? "Photo scan failed.");
      }

      if (typeof payload.scans_remaining_this_month === "number") {
        setUsage((current) => ({
          ...current,
          scansRemaining: payload.scans_remaining_this_month ?? 0,
          scansUsed:
            payload.scans_used_this_month ??
            current.capScans - (payload.scans_remaining_this_month ?? 0),
        }));
      }

      setResult({
        previewUrl,
        textDetected: Boolean(payload.text_detected),
        fullTranslation: payload.full_translation ?? null,
        summary: payload.summary ?? null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Photo scan failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleScanAnother() {
    if (result?.previewUrl) {
      URL.revokeObjectURL(result.previewUrl);
    }
    setResult(null);
    setError(null);
    setStatusMessage(null);
  }

  const captureDisabled = loading || usage.scansRemaining <= 0;

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6">
        <div>
          <BackLink fallbackHref="/dashboard/home">← Back</BackLink>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900">Photo Translate</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Snap a photo of Punjabi text on signs, menus, or labels. Nothing is saved when you leave
            this page.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
          {formatScansRemaining(usage.scansRemaining)}
        </div>

        {statusMessage ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {statusMessage}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.previewUrl} alt="Scanned photo" className="w-full object-contain" />
            </div>

            {result.textDetected ? (
              <>
                {result.summary ? (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                      Summary
                    </p>
                    <p className="mt-2 text-base font-medium leading-relaxed text-violet-950">
                      {result.summary}
                    </p>
                  </div>
                ) : null}

                {result.fullTranslation ? (
                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Full translation
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                      {result.fullTranslation}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                Couldn&apos;t find Punjabi text in this photo — try getting closer or reducing glare.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="relative z-[51] shrink-0 border-t border-zinc-200/80 bg-zinc-50/95 px-0 pb-1 pt-4 backdrop-blur-sm">
        <input
          id={captureInputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={photoCaptureInputClass}
          tabIndex={-1}
          aria-hidden
          disabled={captureDisabled}
          onChange={(event) => void handleFileSelected(event)}
        />

        {!result ? (
          captureDisabled ? (
            <TranslatePrimaryButton disabled onActivate={() => undefined}>
              {loading ? "Translating photo…" : "Take photo"}
            </TranslatePrimaryButton>
          ) : (
            <label
              htmlFor={captureInputId}
              className={cn(
                pressableClass,
                "relative z-[51] flex w-full cursor-pointer items-center justify-center rounded-lg bg-violet-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-violet-500"
              )}
            >
              {loading ? "Translating photo…" : "Take photo"}
            </label>
          )
        ) : (
          <TranslatePrimaryButton disabled={captureDisabled} onActivate={handleScanAnother}>
            Scan another
          </TranslatePrimaryButton>
        )}
      </div>
    </div>
  );
}
