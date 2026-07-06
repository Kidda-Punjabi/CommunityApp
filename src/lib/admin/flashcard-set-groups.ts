import type { FlashcardSet, FlashcardSetCourseAssociation } from "@/app/admin/content/types";

export const FLASHCARD_SET_SECTION_ORDER: FlashcardSetCourseAssociation[] = [
  "foundations",
  "beginners",
  "community",
  "uncategorized",
];

export const FLASHCARD_SET_SECTION_LABELS: Record<FlashcardSetCourseAssociation, string> = {
  foundations: "Foundations",
  beginners: "Beginners",
  community: "Community",
  uncategorized: "Uncategorized",
};

export type FlashcardSetWeekGroup = {
  weekNumber: number | null;
  label: string;
  sets: FlashcardSet[];
};

export type FlashcardSetSection = {
  key: FlashcardSetCourseAssociation;
  label: string;
  sets: FlashcardSet[];
  weekGroups: FlashcardSetWeekGroup[] | null;
};

export function filterFlashcardSetsByName(
  sets: FlashcardSet[],
  searchQuery: string
): FlashcardSet[] {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return sets;
  return sets.filter((set) => set.name.toLowerCase().includes(normalized));
}

export function findMostRecentlyUpdatedSet(sets: FlashcardSet[]): FlashcardSet | null {
  if (sets.length === 0) return null;
  return sets.reduce((latest, set) =>
    set.updated_at > latest.updated_at ? set : latest
  );
}

export function sectionKeyForSet(set: FlashcardSet): FlashcardSetCourseAssociation {
  return set.course_association ?? "uncategorized";
}

export function weekLabel(weekNumber: number | null): string {
  if (weekNumber === null) return "No week assigned";
  return `Week ${weekNumber}`;
}

function sortSetsAlphabetically(sets: FlashcardSet[]): FlashcardSet[] {
  return [...sets].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function buildBeginnersWeekGroups(sets: FlashcardSet[]): FlashcardSetWeekGroup[] {
  const byWeek = new Map<number | null, FlashcardSet[]>();

  for (const set of sets) {
    const week = set.week_number ?? null;
    const bucket = byWeek.get(week) ?? [];
    bucket.push(set);
    byWeek.set(week, bucket);
  }

  const numberedWeeks = [...byWeek.keys()]
    .filter((week): week is number => week !== null)
    .sort((a, b) => a - b);

  const groups: FlashcardSetWeekGroup[] = numberedWeeks.map((weekNumber) => ({
    weekNumber,
    label: weekLabel(weekNumber),
    sets: sortSetsAlphabetically(byWeek.get(weekNumber) ?? []),
  }));

  const unassigned = byWeek.get(null);
  if (unassigned?.length) {
    groups.push({
      weekNumber: null,
      label: weekLabel(null),
      sets: sortSetsAlphabetically(unassigned),
    });
  }

  return groups;
}

export function buildFlashcardSetSections(
  sets: FlashcardSet[],
  searchQuery = ""
): FlashcardSetSection[] {
  const filtered = filterFlashcardSetsByName(sets, searchQuery);

  return FLASHCARD_SET_SECTION_ORDER.map((key) => {
    const sectionSets = filtered.filter((set) => sectionKeyForSet(set) === key);
    const sortedSets = sortSetsAlphabetically(sectionSets);

    return {
      key,
      label: FLASHCARD_SET_SECTION_LABELS[key],
      sets: sortedSets,
      weekGroups: key === "beginners" ? buildBeginnersWeekGroups(sortedSets) : null,
    };
  }).filter((section) => section.sets.length > 0);
}

export function defaultExpandedSectionKey(
  sets: FlashcardSet[]
): FlashcardSetCourseAssociation | null {
  const latest = findMostRecentlyUpdatedSet(sets);
  if (!latest) return null;
  return sectionKeyForSet(latest);
}

export function defaultExpandedWeekNumber(sets: FlashcardSet[]): number | null {
  const latest = findMostRecentlyUpdatedSet(sets);
  if (!latest || sectionKeyForSet(latest) !== "beginners") return null;
  return latest.week_number ?? null;
}
