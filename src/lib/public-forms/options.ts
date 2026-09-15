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

const PUBLIC_COHORT_SPECIALS = [
  "N/A",
  "1-1",
  "1-1 Class",
  "Foundational Course",
  "Community",
  "Refresher course",
] as const;

export type PublicCohortAudience = "adult" | "kids";

export type PublicCohortGroupId = "other" | "beginners" | "kids";

export const PUBLIC_COHORT_GROUP_LABELS: Record<PublicCohortGroupId, string> = {
  other: "Other",
  beginners: "Beginners cohorts",
  kids: "Kids Circle",
};

export function publicCohortAudienceFromCourseName(
  courseName: string | null | undefined
): PublicCohortAudience {
  return /\bkids\b/i.test((courseName ?? "").trim()) ? "kids" : "adult";
}

function isKidsOneToOneOption(name: string): boolean {
  return name === "1-1" || name === "1-1 Class";
}

/** Adult forms: numbered cohorts + 1-1 / Foundational / Community. Kids forms: Kids Circles + 1-1. */
export function filterPublicCohortsForAudience(
  names: readonly string[],
  audience: PublicCohortAudience
): string[] {
  if (audience === "kids") {
    return names.filter(
      (name) => publicCohortGroupId(name) === "kids" || isKidsOneToOneOption(name)
    );
  }
  return names.filter((name) => publicCohortGroupId(name) !== "kids");
}

export function adultCohortLabel(n: number): string {
  return `Cohort ${n}`;
}

export function kidsCircleLabel(n: number): string {
  return `Kids Circle ${n}`;
}

export function buildPublicCohortFallback(
  adultMax = PUBLIC_ADULT_COHORT_MAX,
  kidsMax = PUBLIC_KIDS_CIRCLE_MAX
): string[] {
  const numbered = Array.from({ length: adultMax }, (_, index) => adultCohortLabel(index + 1));
  const kids = Array.from({ length: kidsMax }, (_, index) => kidsCircleLabel(index + 1));
  return mergePublicSelectOptions([...PUBLIC_COHORT_SPECIALS, ...numbered, ...kids], []);
}

export function publicCohortGroupId(name: string): PublicCohortGroupId {
  if (/kids\s*circle\s*\d+/i.test(name)) return "kids";
  if (/^cohort\s*\d+$/i.test(name.trim())) return "beginners";
  return "other";
}

export function groupPublicCohortOptions(
  names: readonly string[]
): Array<{ id: PublicCohortGroupId; label: string; options: string[] }> {
  const grouped: Record<PublicCohortGroupId, string[]> = {
    other: [],
    beginners: [],
    kids: [],
  };
  for (const name of names) {
    grouped[publicCohortGroupId(name)].push(name);
  }
  const otherLabel =
    grouped.beginners.length === 0 && grouped.kids.length > 0
      ? "1-1"
      : PUBLIC_COHORT_GROUP_LABELS.other;

  return (["other", "beginners", "kids"] as const)
    .filter((id) => grouped[id].length > 0)
    .map((id) => ({
      id,
      label: id === "other" ? otherLabel : PUBLIC_COHORT_GROUP_LABELS[id],
      options: grouped[id],
    }));
}

export function canonicalPublicSelectKey(name: string): string {
  const trimmed = name.trim();
  const kids = trimmed.match(/kids\s*circle\s*(\d+)/i);
  if (kids) return `kids-circle-${Number.parseInt(kids[1], 10)}`;
  const cohort = trimmed.match(/^cohort\s*(\d+)$/i);
  if (cohort) return `cohort-${Number.parseInt(cohort[1], 10)}`;
  return trimmed.toLowerCase();
}

function preferredPublicSelectName(current: string | undefined, incoming: string): string {
  const incomingCohort = incoming.match(/^cohort\s*(\d+)$/i);
  if (incomingCohort) return adultCohortLabel(Number.parseInt(incomingCohort[1], 10));
  const incomingKids = incoming.match(/kids\s*circle\s*(\d+)/i);
  if (incomingKids) return kidsCircleLabel(Number.parseInt(incomingKids[1], 10));
  return current ?? incoming;
}

function publicSelectSortValue(name: string): [number, number, string] {
  const group = publicCohortGroupId(name);
  const groupRank = group === "other" ? 0 : group === "beginners" ? 1 : 2;
  const kids = name.match(/kids\s*circle\s*(\d+)/i);
  if (kids) return [groupRank, Number.parseInt(kids[1], 10), name];
  const cohort = name.match(/^cohort\s*(\d+)$/i);
  if (cohort) return [groupRank, Number.parseInt(cohort[1], 10), name];
  const specialIndex = PUBLIC_COHORT_SPECIALS.findIndex(
    (option) => option.toLowerCase() === name.trim().toLowerCase()
  );
  return [groupRank, specialIndex === -1 ? 1000 : specialIndex, name];
}

/** Merge Notion/live names onto the generated list; keep canonical Cohort/Kids Circle spelling. */
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
  if (/^lorem ipsum/i.test(trimmed)) return true;
  if (/^week\s+\d+$/i.test(trimmed)) return true;
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

/** Generated Cohort 1–50 + Kids Circle 1–10 + specials. Merged with live Notion at request time. */
export const PUBLIC_FEEDBACK_COHORT_FALLBACK = buildPublicCohortFallback();
