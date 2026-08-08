import type { EnglishExamQuestion } from "@/lib/learning/english-exam-courses";
import { shuffleEnglishExamQuestions } from "@/lib/learning/load-english-exam-content";

export const PRACTICE_SESSION_SIZE = 20;

export type PracticeOrderMode = "sequential" | "random";
export type PracticeDrawMode = "smart" | "struggles";

export type PracticeStruggleStat = {
  misses: number;
  hits: number;
  lastMissAt: number | null;
};

export type PracticeStruggleMap = Record<string, PracticeStruggleStat>;

const ORDER_KEY = "kidda:english-practice-order";
const struggleKey = (courseId: string) =>
  `kidda:english-practice-struggles:${courseId}`;

export function readPracticeOrderPreference(): PracticeOrderMode {
  if (typeof window === "undefined") return "sequential";
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    return raw === "random" ? "random" : "sequential";
  } catch {
    return "sequential";
  }
}

export function storePracticeOrderPreference(mode: PracticeOrderMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORDER_KEY, mode);
  } catch {
    // Ignore private mode / quota issues.
  }
}

export function readPracticeStruggles(courseId: string): PracticeStruggleMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(struggleKey(courseId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PracticeStruggleMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function storePracticeStruggles(
  courseId: string,
  map: PracticeStruggleMap
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(struggleKey(courseId), JSON.stringify(map));
  } catch {
    // Ignore private mode / quota issues.
  }
}

export function isPracticeStruggle(stat: PracticeStruggleStat | undefined): boolean {
  if (!stat) return false;
  return stat.misses > 0 && stat.misses >= stat.hits;
}

export function listStruggleQuestions(
  bank: EnglishExamQuestion[],
  struggles: PracticeStruggleMap
): EnglishExamQuestion[] {
  return sortQuestionsSequential(
    bank.filter((question) => isPracticeStruggle(struggles[question.id]))
  );
}

export function recordPracticeAttempt(
  map: PracticeStruggleMap,
  questionId: string,
  correct: boolean
): PracticeStruggleMap {
  const prev = map[questionId] ?? { misses: 0, hits: 0, lastMissAt: null };
  if (correct) {
    return {
      ...map,
      [questionId]: {
        ...prev,
        hits: prev.hits + 1,
      },
    };
  }
  return {
    ...map,
    [questionId]: {
      misses: prev.misses + 1,
      hits: prev.hits,
      lastMissAt: Date.now(),
    },
  };
}

export function sortQuestionsSequential(
  questions: EnglishExamQuestion[]
): EnglishExamQuestion[] {
  return [...questions].sort((a, b) => {
    const lessonA = a.lessonNumber ?? Number.MAX_SAFE_INTEGER;
    const lessonB = b.lessonNumber ?? Number.MAX_SAFE_INTEGER;
    if (lessonA !== lessonB) return lessonA - lessonB;
    if (a.questionOrder !== b.questionOrder) {
      return a.questionOrder - b.questionOrder;
    }
    return a.id.localeCompare(b.id);
  });
}

function takeUnique(
  source: EnglishExamQuestion[],
  count: number,
  used: Set<string>
): EnglishExamQuestion[] {
  const out: EnglishExamQuestion[] = [];
  for (const question of source) {
    if (out.length >= count) break;
    if (used.has(question.id)) continue;
    used.add(question.id);
    out.push(question);
  }
  return out;
}

/**
 * Build a practice session (default 20):
 * - smart: bias toward struggles, then under-practised / unseen
 * - struggles: struggle pool only (may be < 20)
 */
export function buildPracticeSession(
  bank: EnglishExamQuestion[],
  struggles: PracticeStruggleMap,
  options: {
    order: PracticeOrderMode;
    draw: PracticeDrawMode;
    size?: number;
  }
): EnglishExamQuestion[] {
  if (bank.length === 0) return [];
  const size = Math.min(options.size ?? PRACTICE_SESSION_SIZE, bank.length);
  const used = new Set<string>();

  const strugglePool = listStruggleQuestions(bank, struggles);
  let picked: EnglishExamQuestion[] = [];

  if (options.draw === "struggles") {
    picked = takeUnique(
      options.order === "random"
        ? shuffleEnglishExamQuestions(strugglePool)
        : strugglePool,
      size,
      used
    );
  } else {
    const struggleSlots = Math.min(
      strugglePool.length,
      Math.max(0, Math.ceil(size * 0.4))
    );
    const shuffledStruggles = shuffleEnglishExamQuestions(strugglePool);
    picked = takeUnique(shuffledStruggles, struggleSlots, used);

    const remaining = size - picked.length;
    const freshFirst = sortQuestionsSequential(bank).sort((a, b) => {
      const sa = struggles[a.id];
      const sb = struggles[b.id];
      const attemptsA = (sa?.hits ?? 0) + (sa?.misses ?? 0);
      const attemptsB = (sb?.hits ?? 0) + (sb?.misses ?? 0);
      if (attemptsA !== attemptsB) return attemptsA - attemptsB;
      return 0;
    });
    const fillerPool =
      options.order === "random"
        ? shuffleEnglishExamQuestions(freshFirst)
        : freshFirst;
    picked = [...picked, ...takeUnique(fillerPool, remaining, used)];
  }

  if (options.order === "random") {
    return shuffleEnglishExamQuestions(picked);
  }
  return sortQuestionsSequential(picked);
}
