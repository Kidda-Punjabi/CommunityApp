/**
 * Notion New Package DB "Capacity" number → app cohorts.capacity.
 *
 * Live schema: every newer package page has a number property named Capacity.
 * Kids Circle / Foundational group pages set it (currently 4). Adult Beginners
 * pages leave it blank (`{ type: "number", number: null }`). Older inbox rows
 * omit the key entirely.
 *
 * Blank and absent are treated the same: no explicit value. Create falls back
 * to DEFAULT_COHORT_CAPACITY (7). Sync/update only writes capacity when Notion
 * has a set value, so a later cron pull cannot reset a manually corrected row
 * (e.g. Cohort 38 at 8) just because Capacity is empty.
 */
export const DEFAULT_COHORT_CAPACITY = 7;

type NotionNumberProperty = {
  type?: string;
  number?: number | null;
  formula?: { type?: string; number?: number | null };
};

export function readNotionCapacity(
  rawProperties: Record<string, unknown> | null | undefined
): number | null {
  if (!rawProperties) return null;

  const prop = rawProperties.Capacity as NotionNumberProperty | null | undefined;
  if (!prop || typeof prop !== "object") return null;

  const raw =
    typeof prop.number === "number" && Number.isFinite(prop.number)
      ? prop.number
      : typeof prop.formula?.number === "number" && Number.isFinite(prop.formula.number)
        ? prop.formula.number
        : null;

  if (raw == null) return null;

  const capacity = Math.round(raw);
  if (capacity < 1) return null;
  return capacity;
}

export function cohortCapacityForInsert(
  rawProperties: Record<string, unknown> | null | undefined
): number {
  return readNotionCapacity(rawProperties) ?? DEFAULT_COHORT_CAPACITY;
}

export function cohortCapacitySyncPatch(
  rawProperties: Record<string, unknown> | null | undefined
): { capacity: number } | Record<string, never> {
  const capacity = readNotionCapacity(rawProperties);
  return capacity == null ? {} : { capacity };
}
