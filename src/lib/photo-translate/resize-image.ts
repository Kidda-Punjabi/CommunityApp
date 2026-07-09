import {
  PHOTO_TRANSLATE_JPEG_QUALITY,
  PHOTO_TRANSLATE_MAX_IMAGE_EDGE_PX,
} from "@/lib/photo-translate/config";

/**
 * Resize and compress a camera photo before upload (browser only).
 * Longest edge capped at ~1500px to balance OCR quality and upload/token cost.
 */
export async function resizeImageForPhotoScan(
  file: File,
  maxEdge = PHOTO_TRANSLATE_MAX_IMAGE_EDGE_PX,
  quality = PHOTO_TRANSLATE_JPEG_QUALITY
): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("Image resize is only available in the browser.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not prepare the image for upload.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) {
    throw new Error("Could not compress the photo.");
  }

  return blob;
}
