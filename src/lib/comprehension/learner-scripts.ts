import type { ComprehensionQuestion } from "./types";
import type { ComprehensionSentence, ComprehensionScriptSummary } from "./types";
import type { ComprehensionTier } from "./tiers";
import { COMPREHENSION_TIERS } from "./tiers";

const DRAFT_DESCRIPTION_PREFIX =
  /^Draft\s*[—–-]\s*pending native speaker review\.?\s*/i;

const ACCESS_SUFFIX = /\s*Access:\s*(free|paid)\.?\s*$/i;

/** Strip internal review / access boilerplate from stored descriptions. */
export function learnerFacingDescription(description: string | null | undefined): string | null {
  if (!description?.trim()) return null;

  const text = description
    .trim()
    .replace(DRAFT_DESCRIPTION_PREFIX, "")
    .replace(ACCESS_SUFFIX, "")
    .trim();

  return text || null;
}

export function scriptListeningReady(sentences: ComprehensionSentence[]): boolean {
  if (sentences.length === 0) return false;
  return sentences.every((sentence) => Boolean(sentence.audio_url?.trim()));
}

/**
 * Learner-visible scripts must be tiered, fully approved (audio), and question-complete.
 * Legacy flat / needs_rewrite rows stay admin-only.
 */
export function isScriptLearnerReady(
  script: ComprehensionScriptSummary,
  sentences: ComprehensionSentence[],
  questions: ComprehensionQuestion[]
): boolean {
  if (!script.active) return false;
  if (!script.tier) return false;
  if (script.needs_rewrite) return false;
  if (script.paragraph_count <= 0) return false;
  if (sentences.length === 0 || questions.length === 0) return false;
  return scriptListeningReady(sentences);
}

export function toLearnerScriptSummary(
  script: ComprehensionScriptSummary
): ComprehensionScriptSummary {
  return {
    ...script,
    description: learnerFacingDescription(script.description),
    difficulty: null,
    needs_rewrite: false,
  };
}

export function filterLearnerScripts(
  scripts: ComprehensionScriptSummary[],
  sentencesByScript: Record<string, ComprehensionSentence[]>,
  questionsByScript: Record<string, ComprehensionQuestion[]>
): ComprehensionScriptSummary[] {
  return scripts
    .filter((script) =>
      isScriptLearnerReady(
        script,
        sentencesByScript[script.id] ?? [],
        questionsByScript[script.id] ?? []
      )
    )
    .map(toLearnerScriptSummary)
    .sort((a, b) => a.display_order - b.display_order);
}

export function learnerScriptsByTier(
  scripts: ComprehensionScriptSummary[]
): Record<ComprehensionTier, ComprehensionScriptSummary[]> {
  const byTier = Object.fromEntries(
    COMPREHENSION_TIERS.map((tier) => [tier, [] as ComprehensionScriptSummary[]])
  ) as Record<ComprehensionTier, ComprehensionScriptSummary[]>;

  for (const script of scripts) {
    if (script.tier) {
      byTier[script.tier].push(script);
    }
  }

  return byTier;
}

export function learnerTierCounts(
  scripts: ComprehensionScriptSummary[]
): Record<ComprehensionTier, number> {
  const byTier = learnerScriptsByTier(scripts);
  return {
    short: byTier.short.length,
    medium: byTier.medium.length,
    long: byTier.long.length,
  };
}

export function scriptAudioStatusLabel(): "Audio ready" {
  return "Audio ready";
}
