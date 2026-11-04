export type PractiseSkill = "words" | "grammar" | "listening" | "speaking";

export type ChecklistRow = { label: string; done: number; total: number; stars?: number };

export type SkillSummary = {
  skill: PractiseSkill;
  label: string;
  pct: number;
  done: number;
  total: number;
  unit: string;
  passLabel: string;
  focus: string;
  rows: ChecklistRow[];
};

export type LevelMeta = {
  level: number;
  name: string;
  gurmukhi: string;
  stage: string;
  can: string;
  wordsTotal: string | null;
  speakingTest: string;
};

export type CheckPartState = {
  part: "words" | "listening";
  label: string;
  detail: string;
  passLabel: string;
  passed: boolean;
  lastScore: string | null;
  lockedUntil: string | null;
};

export type PractiseHome = {
  meta: LevelMeta;
  skills: SkillSummary[];
  weakest: PractiseSkill | null;
  ready: boolean;
  checkParts: CheckPartState[];
  levelUpFrom: number | null;
  playedDates: string[];
};

export type RoundOption = { id: string; label: string; sub?: string };

export type RoundQuestion = {
  itemId: string;
  type: "choice" | "tiles" | "say" | "listen";
  heading: string;
  prompt: string;
  promptIsGurmukhi?: boolean;
  options?: RoundOption[];
  answerId?: string;
  tiles?: string[];
  audioKey?: string;
  /** Sounds cannot be scored by speech recognition, so the learner rates themselves. */
  selfRateOnly?: boolean;
  answer: { gurmukhi: string; romanised: string; english: string };
};

export type RoundAnswer = { itemId: string; correct: boolean };

export type RoundResult = {
  correct: number;
  total: number;
  ticked: string[];
  skillPctBefore: number;
  skillPctAfter: number;
  streak: number | null;
  streakExtended: boolean;
};

export type CheckQuestion = { prompt: string; options: RoundOption[]; audioKey?: string };

export type CheckResult = { passed: boolean; score: number; total: number; message: string };

export type LevelPreview = { meta: LevelMeta; state: "passed" | "locked" | "current"; skills: { label: string; rows: string[] }[] };
