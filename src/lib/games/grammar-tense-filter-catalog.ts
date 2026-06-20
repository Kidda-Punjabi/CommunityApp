import type { TenseGroup } from "@/lib/conjugation/types";
import { formatGrammarTenseLabel, tenseGroupFromGrammarTense } from "@/lib/games/grammar-sentence";

export type GrammarTenseGroupId = TenseGroup;

export type GrammarTenseFilterGroup = {
  id: GrammarTenseGroupId;
  label: string;
  tenses: { id: string; label: string }[];
};

/** Display order within each top-level category — DB `tense` values. */
const GRAMMAR_TENSE_ORDER: Record<GrammarTenseGroupId, string[]> = {
  present: [
    "present_habitual",
    "present_continuous",
    "present_ability",
    "present_necessity",
    "present_desire",
    "present_want",
    "present_need",
    "imperative_direct",
    "imperative_polite",
    "imperative_causative",
    "verbal_subject",
    "verbal_object",
  ],
  past: [
    "past_simple",
    "past_perfect",
    "past_habitual",
    "past_continuous",
    "past_ability",
    "past_necessity_habitual",
    "past_necessity_situational",
    "past_necessity",
  ],
  future: [
    "future_simple",
    "future_perfect",
    "future_ability",
    "future_necessity",
  ],
};

const GROUP_LABELS: Record<GrammarTenseGroupId, string> = {
  present: "Present",
  past: "Past",
  future: "Future",
};

export function buildGrammarTenseFilterGroups(
  availableTenseValues: Iterable<string>
): GrammarTenseFilterGroup[] {
  const available = new Set<string>();
  for (const value of availableTenseValues) {
    const trimmed = value.trim();
    if (trimmed) available.add(trimmed);
  }

  return (["present", "past", "future"] as const)
    .map((groupId) => {
      const ordered: string[] = [];
      const seen = new Set<string>();

      for (const tenseId of GRAMMAR_TENSE_ORDER[groupId]) {
        if (available.has(tenseId)) {
          ordered.push(tenseId);
          seen.add(tenseId);
        }
      }

      const extras = [...available]
        .filter((tenseId) => !seen.has(tenseId) && tenseGroupFromGrammarTense(tenseId) === groupId)
        .sort((a, b) => a.localeCompare(b));

      ordered.push(...extras);

      return {
        id: groupId,
        label: GROUP_LABELS[groupId],
        tenses: ordered.map((id) => ({
          id,
          label: formatGrammarTenseLabel(id),
        })),
      };
    })
    .filter((group) => group.tenses.length > 0);
}
