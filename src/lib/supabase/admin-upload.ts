import { createAdminStorageUploadUrl } from "@/app/admin/content/actions";
import type { StorageBucket } from "@/lib/supabase/upload";

export async function uploadToStorageAsAdmin(bucket: StorageBucket, file: File) {
  const result = await createAdminStorageUploadUrl(bucket, file.name);

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.signedUrl || !result.publicUrl) {
    throw new Error("Failed to prepare upload.");
  }

  const response = await fetch(result.signedUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}).`);
  }

  return result.publicUrl;
}

export async function appendAdminUploadedFileUrl(
  formData: FormData,
  fileField: string,
  bucket: StorageBucket,
  urlField: string
) {
  const file = formData.get(fileField) as File | null;
  formData.delete(fileField);

  if (file?.size) {
    const url = await uploadToStorageAsAdmin(bucket, file);
    formData.set(urlField, url);
  }
}
