import "server-only";

import raw from "./master-lists.json";
import { INCLUDE_DRAFTED_CONTENT, ITEM_DONE_AT, RULE_CORRECT_PER_STAR } from "./levels";
import type { PractiseSkill } from "./types";

export type Item = { id: string; l: number; k: "w" | "s" | "m" | "p" | "v" | "r"; t: string; e: string; g: string; r: string; x?: string; d?: number };

const ITEMS = (raw as Item[]).filter((i) => INCLUDE_DRAFTED_CONTENT || !i.d);
const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export const itemById = (id: string) => BY_ID.get(id);
export const wordsAt = (level: number) => ITEMS.filter((i) => i.k === "w" && i.l === level);
export const wordsBelow = (level: number) => ITEMS.filter((i) => i.k === "w" && i.l < level);
export const rulesAt = (level: number) => ITEMS.filter((i) => i.k === "r" && i.l === level);
/** Level 9 has no list of its own, so it keeps every earlier sentence sharp. */
export const sentencesAt = (level: number) =>
  ITEMS.filter((i) => i.k === "s" && (level === 9 ? true : i.l === level));

export function skillsForLevel(level: number): PractiseSkill[] {
  return level === 0 || level === 9 ? ["listening", "speaking"] : ["words", "grammar", "listening", "speaking"];
}

export function poolFor(level: number, skill: PractiseSkill): Item[] {
  if (skill === "words") return wordsAt(level);
  if (skill === "grammar") return rulesAt(level);
  if (level === 0) {
    const kinds = skill === "listening" ? ["p", "v"] : ["m", "v"];
    return ITEMS.filter((i) => i.l === 0 && kinds.includes(i.k));
  }
  return sentencesAt(level);
}

export function isItemDone(skill: PractiseSkill, correct: number) {
  return correct >= (skill === "grammar" ? RULE_CORRECT_PER_STAR * 3 : ITEM_DONE_AT);
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "Beginner W1-2" and "Intermediate Week 3" read as "Week 1-2" and "Week 3". */
export function cleanTopic(topic: string): string {
  const t = topic
    .replace(/^(Beginner|Intermediate|Advanced)\s+/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\bW(\d)/g, "Week $1")
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "Other";
}

/** First week number in a topic such as "W5, W8" or "Beginner Week 7". */
export function weekNumbers(topic: string): number[] {
  return [...topic.matchAll(/W(?:eek\s*)?(\d+)/gi)].map((m) => Number(m[1]));
}

export function grammarSentencesFor(rule: Item): Item[] {
  const usable = sentencesAt(rule.l).filter((s) => s.r.split(/\s+/).length >= 3);
  const weeks = weekNumbers(rule.t);
  const matched = usable.filter((s) => weekNumbers(s.t).some((w) => weeks.includes(w)));
  return matched.length >= 3 ? matched : usable;
}
