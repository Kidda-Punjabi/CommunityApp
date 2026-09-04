import { createClient } from "@/lib/supabase/client";
import { FEEDBACK_PHOTOS_BUCKET } from "./photo-url";

export { FEEDBACK_PHOTOS_BUCKET, isAllowedFeedbackPhotoUrl } from "./photo-url";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export function validateFeedbackPhotoFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Please choose a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  return null;
}

export async function uploadFeedbackPhoto(file: File): Promise<string> {
  const validationError = validateFeedbackPhotoFile(file);
  if (validationError) throw new Error(validationError);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const ext = extensionForType(file.type);
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(FEEDBACK_PHOTOS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    if (error.message.toLowerCase().includes("bucket not found")) {
      throw new Error(
        "Photo storage is not set up yet. Run supabase/feedback-week1-and-photos.sql in the Supabase SQL Editor."
      );
    }
    throw new Error(error.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(FEEDBACK_PHOTOS_BUCKET).getPublicUrl(path);

  return publicUrl;
}
