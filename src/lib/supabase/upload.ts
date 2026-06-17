import { createClient } from "@/lib/supabase/client";

export type StorageBucket = "audio-files" | "profile-photos";

export async function uploadToStorage(bucket: StorageBucket, file: File) {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error(error.message);

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
