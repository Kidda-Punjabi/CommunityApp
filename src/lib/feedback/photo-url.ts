export const FEEDBACK_PHOTOS_BUCKET = "feedback-photos";

export function isAllowedFeedbackPhotoUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    const parsed = new URL(url);
    const allowed = new URL(base);
    return (
      parsed.origin === allowed.origin &&
      parsed.pathname.includes(`/storage/v1/object/public/${FEEDBACK_PHOTOS_BUCKET}/`)
    );
  } catch {
    return false;
  }
}
