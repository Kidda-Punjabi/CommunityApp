import { validateFeedbackPhotoFile } from "@/lib/feedback/upload-photo";

export async function uploadPublicFeedbackPhoto(slug: string, file: File): Promise<string> {
  const validationError = validateFeedbackPhotoFile(file);
  if (validationError) throw new Error(validationError);

  const body = new FormData();
  body.append("slug", slug);
  body.append("file", file);

  const response = await fetch("/api/public/feedback/photo", {
    method: "POST",
    body,
  });

  const data = (await response.json()) as { error?: string; url?: string };
  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Failed to upload photo.");
  }
  return data.url;
}
