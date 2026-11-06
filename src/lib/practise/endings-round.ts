import "server-only";

import { shuffle } from "./content";
import type { EndingQuestion } from "./endings-bank";
import type { PractiseSkill, RoundQuestion } from "./types";

export function endingRoundQuestion(q: EndingQuestion, skill: PractiseSkill, itemId: string, seenId?: string): RoundQuestion {
  return {
    skill,
    itemId,
    seenId,
    type: "endings",
    heading: q.answers.length > 1 ? "Pick the endings" : "Pick the ending",
    prompt: q.english,
    audioKey: q.id,
    endings: { parts: q.parts, romanParts: q.romanParts, answers: q.answers, cards: shuffle(q.cards) },
    answer: { gurmukhi: q.gurmukhi, romanised: q.romanised, english: q.english },
  };
}

/** Up to two endings in a grammar set. Once they have all been seen, one comes back as a review question. */
export function pickEndings(all: EndingQuestion[], seen: (id: string) => boolean, used: Set<string>, n: number) {
  const free = all.filter((q) => !used.has(q.id));
  const unseen = shuffle(free.filter((q) => !seen(q.id)));
  if (unseen.length) return { picked: unseen.slice(0, Math.min(2, n)), review: false };
  return { picked: shuffle(free).slice(0, Math.min(1, n)), review: free.length > 0 && n > 0 };
}
