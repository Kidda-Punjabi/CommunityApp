/** Tutors shown on public feedback/quiz links (Notion Tutor select). */
export const PUBLIC_FEEDBACK_TUTOR_OPTIONS = [
  "Arshdeep Kaur",
  "Jasleen Kaur",
  "Tarnjot Kaur",
  "Navjit Kaur",
  "Mankeerat Kaur",
  "Gurupma Singh",
] as const;

export type PublicFeedbackTutor = (typeof PUBLIC_FEEDBACK_TUTOR_OPTIONS)[number];

export function isPublicFeedbackTutor(
  value: string,
  allowed: readonly string[] = PUBLIC_FEEDBACK_TUTOR_OPTIONS
): value is PublicFeedbackTutor {
  return allowed.includes(value);
}

export const PUBLIC_ADULT_COHORT_MAX = 50;
export const PUBLIC_KIDS_CIRCLE_MAX = 10;
export const PUBLIC_FOUNDATIONAL_GROUP_MAX = 10;

const PUBLIC_COHORT_SPECIALS = ["1-1", "Community", "Refresher course"] as const;

export type PublicCohortAudience = "beginners" | "foundational" | "kids";

export type PublicCohortGroupId = "oneToOne" | "beginners" | "foundational" | "kids" | "other";

export const PUBLIC_COHORT_GROUP_LABELS: Record<PublicCohortGroupId, string> = {
  oneToOne: "1-1",
  beginners: "Beginners cohorts",
  foundational: "Group Foundational",
  kids: "Kids Circle",
  other: "Other",
};

export function publicCohortAudienceFromCourse(input: {
  courseName?: string | null;
  contentTrack?: string | null;
}): PublicCohortAudience {
  if ((input.contentTrack ?? "").trim().toLowerCase() === "kids") return "kids";
  const name = (input.courseName ?? "").trim();
  if (/\bkids\b/i.test(name)) return "kids";
  if (/foundational/i.test(name)) return "foundational";
  return "beginners";
}

export function publicCohortAudienceFromCourseName(
  courseName: string | null | undefined
): PublicCohortAudience {
  return publicCohortAudienceFromCourse({ courseName });
}

export function publicCohortPlaceholder(audience: PublicCohortAudience): string {
  if (audience === "kids") return "Select your Kids Circle or 1-1";
  if (audience === "foundational") return "Select your foundational group or 1-1";
  return "Select your cohort";
}

export function adultCohortLabel(n: number): string {
  return `Cohort ${n}`;
}

export function kidsCircleLabel(n: number): string {
  return `Kids Circle ${n}`;
}

export function groupFoundationalLabel(n: number): string {
  return `Group Foundational ${n}`;
}

export function buildPublicCohortFallback(
  adultMax = PUBLIC_ADULT_COHORT_MAX,
  kidsMax = PUBLIC_KIDS_CIRCLE_MAX,
  foundationalMax = PUBLIC_FOUNDATIONAL_GROUP_MAX
): string[] {
  const numbered = Array.from({ length: adultMax }, (_, index) => adultCohortLabel(index + 1));
  const kids = Array.from({ length: kidsMax }, (_, index) => kidsCircleLabel(index + 1));
  const foundational = Array.from({ length: foundationalMax }, (_, index) =>
    groupFoundationalLabel(index + 1)
  );
  return mergePublicSelectOptions(
    [...PUBLIC_COHORT_SPECIALS, ...numbered, ...kids, ...foundational],
    []
  );
}

export function publicCohortGroupId(name: string): PublicCohortGroupId {
  if (isOneToOneOption(name)) return "oneToOne";
  if (/kids\s*circle\s*\d+/i.test(name)) return "kids";
  if (/group\s*foundational\s*\d+/i.test(name) || /foundational\s*group\s*\d+/i.test(name)) {
    return "foundational";
  }
  if (/^cohort\s*\d+$/i.test(name.trim())) return "beginners";
  return "other";
}

/** Beginners: Cohort 1–50 + 1-1. Foundational: Group Foundational 1–10 + 1-1. Kids: Kids Circle + 1-1. */
export function filterPublicCohortsForAudience(
  names: readonly string[],
  audience: PublicCohortAudience
): string[] {
  return names.filter((name) => {
    const group = publicCohortGroupId(name);
    if (group === "oneToOne") return true;
    if (audience === "kids") return group === "kids";
    if (audience === "foundational") return group === "foundational";
    return group === "beginners" || group === "other";
  });
}

export function groupPublicCohortOptions(
  names: readonly string[]
): Array<{ id: PublicCohortGroupId; label: string; options: string[] }> {
  const grouped: Record<PublicCohortGroupId, string[]> = {
    oneToOne: [],
    beginners: [],
    foundational: [],
    kids: [],
    other: [],
  };
  for (const name of names) {
    grouped[publicCohortGroupId(name)].push(name);
  }
  return (["oneToOne", "beginners", "foundational", "kids", "other"] as const)
    .filter((id) => grouped[id].length > 0)
    .map((id) => ({
      id,
      label: PUBLIC_COHORT_GROUP_LABELS[id],
      options: grouped[id],
    }));
}

export function canonicalPublicSelectKey(name: string): string {
  const trimmed = name.trim();
  if (isOneToOneOption(trimmed)) return "1-1";
  const kids = trimmed.match(/kids\s*circle\s*(\d+)/i);
  if (kids) return `kids-circle-${Number.parseInt(kids[1], 10)}`;
  const foundational = trimmed.match(/(?:group\s*foundational|foundational\s*group)\s*(\d+)/i);
  if (foundational) return `group-foundational-${Number.parseInt(foundational[1], 10)}`;
  const cohort = trimmed.match(/^cohort\s*(\d+)$/i);
  if (cohort) return `cohort-${Number.parseInt(cohort[1], 10)}`;
  return trimmed.toLowerCase();
}

function isOneToOneOption(name: string): boolean {
  return /^1\s*-\s*1(\s*class)?$/i.test(name.trim());
}

function preferredPublicSelectName(current: string | undefined, incoming: string): string {
  if (isOneToOneOption(incoming)) return "1-1";
  const incomingCohort = incoming.match(/^cohort\s*(\d+)$/i);
  if (incomingCohort) return adultCohortLabel(Number.parseInt(incomingCohort[1], 10));
  const incomingKids = incoming.match(/kids\s*circle\s*(\d+)/i);
  if (incomingKids) return kidsCircleLabel(Number.parseInt(incomingKids[1], 10));
  const incomingFoundational = incoming.match(
    /(?:group\s*foundational|foundational\s*group)\s*(\d+)/i
  );
  if (incomingFoundational) {
    return groupFoundationalLabel(Number.parseInt(incomingFoundational[1], 10));
  }
  return current ?? incoming;
}

function publicSelectSortValue(name: string): [number, number, string] {
  const group = publicCohortGroupId(name);
  const groupRank =
    group === "oneToOne" ? 0 : group === "beginners" ? 1 : group === "foundational" ? 2 : group === "kids" ? 3 : 4;
  const kids = name.match(/kids\s*circle\s*(\d+)/i);
  if (kids) return [groupRank, Number.parseInt(kids[1], 10), name];
  const foundational = name.match(/(?:group\s*foundational|foundational\s*group)\s*(\d+)/i);
  if (foundational) return [groupRank, Number.parseInt(foundational[1], 10), name];
  const cohort = name.match(/^cohort\s*(\d+)$/i);
  if (cohort) return [groupRank, Number.parseInt(cohort[1], 10), name];
  const specialIndex = PUBLIC_COHORT_SPECIALS.findIndex(
    (option) => option.toLowerCase() === name.trim().toLowerCase()
  );
  return [groupRank, specialIndex === -1 ? 1000 : specialIndex, name];
}

/** Merge Notion/live names onto the generated list; keep canonical spelling. */
export function mergePublicSelectOptions(
  fallback: readonly string[],
  extra: readonly string[]
): string[] {
  const byKey = new Map<string, string>();
  for (const name of [...fallback, ...extra]) {
    const trimmed = name.trim();
    if (!trimmed || isJunkPublicSelectName(trimmed)) continue;
    const key = canonicalPublicSelectKey(trimmed);
    byKey.set(key, preferredPublicSelectName(byKey.get(key), trimmed));
  }
  return [...byKey.values()].sort((a, b) => {
    const [ag, an, al] = publicSelectSortValue(a);
    const [bg, bn, bl] = publicSelectSortValue(b);
    return ag - bg || an - bn || al.localeCompare(bl);
  });
}

export function isJunkPublicSelectName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (/^n\/a$/i.test(trimmed)) return true;
  if (/^lorem ipsum/i.test(trimmed)) return true;
  if (/^week\s+\d+$/i.test(trimmed)) return true;
  if (/^foundational course$/i.test(trimmed)) return true;
  return false;
}

export function isPublicTutorSelectName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || isJunkPublicSelectName(trimmed)) return false;
  if (/^(cohort|week)\s/i.test(trimmed)) return false;
  if ((PUBLIC_FEEDBACK_TUTOR_OPTIONS as readonly string[]).includes(trimmed)) return true;
  return /\b(kaur|singh)\b/i.test(trimmed);
}

export function mergePublicTutorOptions(
  fallback: readonly string[],
  extra: readonly string[]
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of [...fallback, ...extra]) {
    const trimmed = name.trim();
    if (!isPublicTutorSelectName(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  return names;
}

/** Generated Cohort 1–50, Kids Circle 1–10, Group Foundational 1–10, plus 1-1 / Community / Refresher. */
export const PUBLIC_FEEDBACK_COHORT_FALLBACK = buildPublicCohortFallback();

/** Prefer the live/server list, but never show the wrong course type. */
export function cohortsForPublicForm(
  names: readonly string[],
  audience: PublicCohortAudience
): string[] {
  const filtered = filterPublicCohortsForAudience(names, audience);
  const expectedGroup: PublicCohortGroupId =
    audience === "kids" ? "kids" : audience === "foundational" ? "foundational" : "beginners";
  if (filtered.some((name) => publicCohortGroupId(name) === expectedGroup)) return filtered;
  return filterPublicCohortsForAudience(PUBLIC_FEEDBACK_COHORT_FALLBACK, audience);
}
