/** Build catch-up return URL for activity deep-links. */
export function buildCatchupReturnUrl(lessonId: string, nextSegmentNumber: number): string {
  const params = new URLSearchParams({ segment: String(nextSegmentNumber) });
  return `/catchup/${lessonId}?${params.toString()}`;
}

export function parseCatchupReturn(value: string | null | undefined): {
  lessonId: string;
  segment: number;
} | null {
  if (!value?.trim()) return null;
  try {
    const url = value.startsWith("http")
      ? new URL(value)
      : new URL(value, "https://app.local");
    const match = url.pathname.match(/^\/catchup\/([^/]+)$/);
    if (!match) return null;
    const segment = Number(url.searchParams.get("segment") ?? "1");
    if (!Number.isFinite(segment) || segment < 1) return null;
    return { lessonId: match[1], segment };
  } catch {
    return null;
  }
}

export const CATCHUP_RETURN_PARAM = "catchupReturn";
