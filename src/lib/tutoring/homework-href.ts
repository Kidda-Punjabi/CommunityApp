import { CATCHUP_RETURN_PARAM } from "@/lib/catchup/return-url";

export function lessonHomeworkPath(
  lessonId: string,
  catchupReturn?: string | null
): string {
  const base = `/dashboard/learn/homework/${lessonId}`;
  if (!catchupReturn) return base;
  return `${base}?${CATCHUP_RETURN_PARAM}=${encodeURIComponent(catchupReturn)}`;
}

export function learnHomeworkBackHref(
  requiredTier: string | null | undefined,
  lessonId: string,
  courseId?: string | null
): string {
  const track =
    requiredTier === "foundational"
      ? "foundational"
      : requiredTier === "beginners"
        ? "beginners"
        : requiredTier === "community"
          ? "community"
          : null;
  if (track) return `/dashboard/learn/${track}#lesson-${lessonId}`;
  if (courseId && (requiredTier === "private" || requiredTier === "kids")) {
    return `/dashboard/learn/kids/${courseId}#lesson-${lessonId}`;
  }
  return `/dashboard/learn#lesson-${lessonId}`;
}
