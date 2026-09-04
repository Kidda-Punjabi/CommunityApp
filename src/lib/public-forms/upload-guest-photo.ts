import "server-only";

import { FEEDBACK_PHOTOS_BUCKET } from "@/lib/feedback/photo-url";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadGuestFeedbackPhoto(file: File): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    throw new Error("Please choose a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const supabase = createServiceRoleClient();
  const path = `guest/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(FEEDBACK_PHOTOS_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(FEEDBACK_PHOTOS_BUCKET).getPublicUrl(path);

  return publicUrl;
}
