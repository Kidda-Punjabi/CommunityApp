import { DELIVERY_CLASS_TYPES, type DeliveryClassTypeId } from "@/lib/admin/delivery/constants";
import type {
  DeliveryChartPoint,
  DeliveryClassTypeBreakdown,
  DeliveryOpsMetric,
  DeliveryRatingMetric,
} from "@/lib/admin/delivery/types";
import { formatLondonYmd, londonCivilToUtc } from "@/lib/admin/delivery/date-range";

export function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export function round1(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

export function round0(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

export function ratingMetric(
  currentValues: Array<number | null | undefined>,
  previousValues: Array<number | null | undefined>
): DeliveryRatingMetric {
  const current = average(currentValues);
  const previous = average(previousValues);
  return {
    current: round1(current),
    previous: round1(previous),
    delta: current != null && previous != null ? round1(current - previous) : null,
    sampleSize: currentValues.filter((value) => typeof value === "number" && Number.isFinite(value)).length,
  };
}

export function percentMetric(
  hits: number,
  total: number
): number | null {
  if (total <= 0) return null;
  return round0((hits / total) * 100);
}

export function opsMetricFromGroups(
  groups: Array<{ classType: DeliveryClassTypeId; hits: number; total: number }>
): DeliveryOpsMetric {
  const byClassType: DeliveryClassTypeBreakdown[] = DELIVERY_CLASS_TYPES.map((type) => {
    const group = groups.find((entry) => entry.classType === type.id);
    const total = group?.total ?? 0;
    const hits = group?.hits ?? 0;
    return {
      classType: type.id,
      label: type.label,
      value: percentMetric(hits, total),
      sampleSize: total,
    };
  });
  const hits = groups.reduce((sum, group) => sum + group.hits, 0);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  return {
    overall: percentMetric(hits, total),
    sampleSize: total,
    byClassType,
  };
}

export function averageOpsMetricFromGroups(
  groups: Array<{ classType: DeliveryClassTypeId; values: number[] }>
): DeliveryOpsMetric {
  const byClassType: DeliveryClassTypeBreakdown[] = DELIVERY_CLASS_TYPES.map((type) => {
    const group = groups.find((entry) => entry.classType === type.id);
    const values = group?.values ?? [];
    return {
      classType: type.id,
      label: type.label,
      value: round0(average(values)),
      sampleSize: values.length,
    };
  });
  const values = groups.flatMap((group) => group.values);
  return {
    overall: round0(average(values)),
    sampleSize: values.length,
    byClassType,
  };
}

export function daysBetween(fromIso: string | null | undefined, now: Date): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return null;
  return Math.max(0, Math.floor((now.getTime() - from) / (24 * 60 * 60 * 1000)));
}

export function consecutiveTrailingFalse(flags: Array<boolean | null>): number {
  let count = 0;
  for (let index = flags.length - 1; index >= 0; index -= 1) {
    if (flags[index] !== false) break;
    count += 1;
  }
  return count;
}

function bucketKey(iso: string, weekly: boolean): { key: string; label: string } {
  const ymd = formatLondonYmd(new Date(iso));
  if (!weekly) {
    const date = londonCivilToUtc(ymd, 12);
    const label = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "short",
    }).format(date);
    return { key: ymd, label };
  }
  const date = londonCivilToUtc(ymd, 12);
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  const weekYmd = formatLondonYmd(date);
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
  }).format(londonCivilToUtc(weekYmd, 12));
  return { key: weekYmd, label: `w/c ${label}` };
}

export function buildRatingChart(
  rows: Array<{
    feedbackDate: string | null;
    learningRelevance: number | null;
    confidence: number | null;
    tutorEffectiveness: number | null;
  }>,
  start: Date,
  end: Date
): DeliveryChartPoint[] {
  const spanDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  const weekly = spanDays > 21;
  const buckets = new Map<
    string,
    {
      label: string;
      learningRelevance: number[];
      confidence: number[];
      tutorEffectiveness: number[];
    }
  >();

  for (const row of rows) {
    if (!row.feedbackDate) continue;
    const { key, label } = bucketKey(row.feedbackDate, weekly);
    const bucket = buckets.get(key) ?? {
      label,
      learningRelevance: [],
      confidence: [],
      tutorEffectiveness: [],
    };
    if (row.learningRelevance != null) bucket.learningRelevance.push(row.learningRelevance);
    if (row.confidence != null) bucket.confidence.push(row.confidence);
    if (row.tutorEffectiveness != null) bucket.tutorEffectiveness.push(row.tutorEffectiveness);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      learningRelevance: round1(average(bucket.learningRelevance)),
      confidence: round1(average(bucket.confidence)),
      tutorEffectiveness: round1(average(bucket.tutorEffectiveness)),
    }));
}

export function notionWinsTwoWay(
  notionLastEdited: string | null | undefined,
  localUpdatedAt: string | null | undefined
): boolean {
  if (!localUpdatedAt) return true;
  if (!notionLastEdited) return false;
  return new Date(notionLastEdited).getTime() > new Date(localUpdatedAt).getTime();
}
