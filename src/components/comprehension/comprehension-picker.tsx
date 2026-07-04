"use client";

import { BackLink } from "@/components/navigation/back-link";
import {
  learnerScriptsByTier,
  learnerTierCounts,
  scriptAudioStatusLabel,
} from "@/lib/comprehension/learner-scripts";
import { COMPREHENSION_PRACTICE_DISPLAY_NAME } from "@/lib/comprehension/config";
import {
  COMPREHENSION_TIER_ICONS,
  COMPREHENSION_TIER_LEARNER_DESCRIPTIONS,
} from "@/lib/comprehension/tier-picker-copy";
import {
  COMPREHENSION_TIER_LABELS,
  COMPREHENSION_TIERS,
  type ComprehensionTier,
} from "@/lib/comprehension/tiers";
import type { ComprehensionScriptSummary } from "@/lib/comprehension/types";
import { GAMES_HUB_HREF } from "@/lib/games/catalog";

type ComprehensionTierPickerProps = {
  scripts: ComprehensionScriptSummary[];
  onSelectTier: (tier: ComprehensionTier) => void;
};

export function ComprehensionTierPicker({ scripts, onSelectTier }: ComprehensionTierPickerProps) {
  const counts = learnerTierCounts(scripts);

  return (
    <div className="space-y-6">
      <div>
        <BackLink
          fallbackHref={GAMES_HUB_HREF}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to games
        </BackLink>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
          {COMPREHENSION_PRACTICE_DISPLAY_NAME}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Choose your level</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Pick how long you want each passage to be, then choose a story to practise.
        </p>
      </div>

      {scripts.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          New passages are on their way — check back soon.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1">
          {COMPREHENSION_TIERS.map((tier) => {
            const count = counts[tier];
            const disabled = count === 0;

            return (
              <button
                key={tier}
                type="button"
                disabled={disabled}
                onClick={() => onSelectTier(tier)}
                className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <p className="text-2xl" aria-hidden="true">
                  {COMPREHENSION_TIER_ICONS[tier]}
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-900">
                  {COMPREHENSION_TIER_LABELS[tier]}
                </p>
                <p className="mt-1 text-sm text-violet-600">
                  {COMPREHENSION_TIER_LEARNER_DESCRIPTIONS[tier]}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {count} script{count === 1 ? "" : "s"}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ComprehensionScriptListProps = {
  tier: ComprehensionTier;
  scripts: ComprehensionScriptSummary[];
  onBack: () => void;
  onSelectScript: (script: ComprehensionScriptSummary) => void;
};

export function ComprehensionScriptList({
  tier,
  scripts,
  onBack,
  onSelectScript,
}: ComprehensionScriptListProps) {
  const tierScripts = learnerScriptsByTier(scripts)[tier];

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to levels
        </button>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-600">
          {COMPREHENSION_TIER_LABELS[tier]}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">
          {COMPREHENSION_TIER_LABELS[tier]} scripts
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {COMPREHENSION_TIER_LEARNER_DESCRIPTIONS[tier]}
        </p>
      </div>

      {tierScripts.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No scripts at this level yet.
        </p>
      ) : (
        <div className="space-y-3">
          {tierScripts.map((script) => (
            <button
              key={script.id}
              type="button"
              onClick={() => onSelectScript(script)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/30"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden="true">
                  {COMPREHENSION_TIER_ICONS[tier]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900">{script.title}</p>
                  {script.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{script.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-zinc-500">
                    {script.sentence_count} sentence{script.sentence_count === 1 ? "" : "s"}
                    {" · "}
                    {script.question_count} question{script.question_count === 1 ? "" : "s"}
                    {" · "}
                    {scriptAudioStatusLabel()}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
