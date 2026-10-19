const FEEDBACK_PHOTO_MARKER = "/storage/v1/object/public/feedback-photos/";

/** Object path inside the feedback-photos bucket, from a public URL or a bare path. */
export function feedbackPhotoObjectPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.includes("..")) return null;

  const markerAt = trimmed.indexOf(FEEDBACK_PHOTO_MARKER);
  const raw = markerAt === -1 ? trimmed : trimmed.slice(markerAt + FEEDBACK_PHOTO_MARKER.length);
  const path = decodePath(raw.split(/[?#]/, 1)[0] ?? "").replace(/^\/+/, "");
  if (!path || path.includes("..")) return null;
  if (markerAt === -1 && /^https?:\/\//i.test(trimmed)) return null;
  return path;
}

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
