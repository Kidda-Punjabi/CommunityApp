import { createClient } from "@/lib/supabase/client";

export type StorageBucket =
  | "audio-files"
  | "profile-photos"
  | "lesson-pdfs"
  | "site-branding"
  | "comprehension-audio"
  | "lesson-audio"
  | "lesson-log-media"
  | "feedback-photos";

export async function uploadToStorage(bucket: StorageBucket, file: File) {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("bucket not found")) {
      throw new Error(
        'Storage bucket not found. Reload /admin/content (creates buckets automatically), or run supabase/lesson-pdfs-bucket.sql in the Supabase SQL Editor.'
      );
    }
    if (message.includes("row-level security")) {
      throw new Error(
        `${error.message} Run supabase/lesson-pdfs-bucket.sql in the Supabase SQL Editor, or use the admin upload flow.`
      );
    }
    throw new Error(error.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}

export async function appendUploadedFileUrl(
  formData: FormData,
  fileField: string,
  bucket: StorageBucket,
  urlField: string
) {
  const file = formData.get(fileField) as File | null;
  formData.delete(fileField);

  if (file?.size) {
    const url = await uploadToStorage(bucket, file);
    formData.set(urlField, url);
  }
}
