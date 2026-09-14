import { isKidAgeTier, type KidAgeTier } from "@/lib/kids/constants";

export const KIDS_COHORT_AGE_GROUP_MISMATCH =
  "You can only switch to a cohort in the same age group.";

const AGE_GROUP_ALIASES: Record<string, KidAgeTier> = {
  kids: "kids",
  little_ones: "kids",
  pre_reader: "kids",
  juniors: "juniors",
  early_reader: "juniors",
  preteens: "preteens",
  pre_teen: "preteens",
  teens: "teens",
  independent: "teens",
};

/** Canonical kids class band from `cohorts.age_group` (not title parsing). */
export function normalizeKidsCohortAgeGroup(
  value: string | null | undefined
): KidAgeTier | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const aliased = AGE_GROUP_ALIASES[normalized];
  if (aliased) return aliased;
  return isKidAgeTier(normalized) ? normalized : null;
}

export function kidsCohortsShareAgeGroup(
  fromAgeGroup: string | null | undefined,
  toAgeGroup: string | null | undefined
): boolean {
  const from = normalizeKidsCohortAgeGroup(fromAgeGroup);
  const to = normalizeKidsCohortAgeGroup(toAgeGroup);
  return from != null && to != null && from === to;
}
