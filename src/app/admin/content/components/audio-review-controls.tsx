"use client";

import type { PendingVariation } from "@/app/admin/content/audio-actions";
import { useState } from "react";
import { buttonClass, inputClass, labelClass, secondaryButtonClass } from "./ui";

export function VariationPicker({
  variations,
  selectedId,
  onSelect,
}: {
  variations: PendingVariation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {variations.map((variation) => (
        <button
          key={variation.id}
          type="button"
          onClick={() => onSelect(variation.id)}
          className={`rounded-xl border p-3 text-left transition-colors ${
            selectedId === variation.id
              ? "border-violet-500 bg-violet-50 ring-1 ring-violet-200"
              : "border-zinc-200 bg-white hover:border-violet-200"
          }`}
        >
          <p className="text-sm font-semibold text-zinc-900">
            Take {variation.variationIndex + 1}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{variation.voiceLabel}</p>
          <audio
            controls
            preload="metadata"
            className="mt-2 w-full"
            src={variation.pendingAudioUrl}
            onClick={(event) => event.stopPropagation()}
          />
        </button>
      ))}
    </div>
  );
}

export function GenerateControl({
  label,
  pending,
  disabled,
  onGenerate,
}: {
  label: string;
  pending: boolean;
  disabled?: boolean;
  onGenerate: (variationCount: number) => void;
}) {
  const [variationCount, setVariationCount] = useState<1 | 3>(1);
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="flex flex-wrap items-start gap-2">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => onGenerate(variationCount)}
        className={secondaryButtonClass}
      >
        {pending ? "Working…" : label}
      </button>
      <div className="relative">
        <button
          type="button"
          disabled={pending || disabled}
          onClick={() => setShowOptions((open) => !open)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-600 hover:border-violet-200"
          aria-label="Generation options"
        >
          ▾
        </button>
        {showOptions ? (
          <div className="absolute left-0 z-10 mt-1 min-w-[10rem] rounded-lg border border-zinc-200 bg-white p-3 shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Takes</p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name="variation-count"
                checked={variationCount === 1}
                onChange={() => setVariationCount(1)}
              />
              1 take
            </label>
            <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name="variation-count"
                checked={variationCount === 3}
                onChange={() => setVariationCount(3)}
              />
              3 variations
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PronunciationFixForm({
  mispronouncedWord,
  correction,
  ruleType,
  pending,
  disabled,
  onWordChange,
  onCorrectionChange,
  onRuleTypeChange,
  onSubmit,
}: {
  mispronouncedWord: string;
  correction: string;
  ruleType: "alias" | "phoneme";
  pending: boolean;
  disabled?: boolean;
  onWordChange: (value: string) => void;
  onCorrectionChange: (value: string) => void;
  onRuleTypeChange: (value: "alias" | "phoneme") => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Mispronounced word</label>
          <input
            value={mispronouncedWord}
            onChange={(event) => onWordChange(event.target.value)}
            className={`${inputClass} mt-1 font-normal`}
            dir="auto"
          />
        </div>
        <div>
          <label className={labelClass}>Correction</label>
          <input
            value={correction}
            onChange={(event) => onCorrectionChange(event.target.value)}
            className={`${inputClass} mt-1 font-normal`}
            placeholder="alias spelling or IPA"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Rule type</label>
        <select
          value={ruleType}
          onChange={(event) => onRuleTypeChange(event.target.value as "alias" | "phoneme")}
          className={`${inputClass} mt-1 font-normal`}
        >
          <option value="alias">Alias (works on all models)</option>
          <option value="phoneme">Phoneme / IPA (eleven_v3)</option>
        </select>
      </div>
      <button
        type="button"
        disabled={pending || disabled || !mispronouncedWord.trim() || !correction.trim()}
        onClick={onSubmit}
        className={buttonClass}
      >
        Save rule &amp; regenerate
      </button>
    </div>
  );
}
