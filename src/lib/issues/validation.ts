import { extensionOf } from "@/lib/issues/filename";
import {
  ISSUE_ALLOWED_MIME_TYPES,
  ISSUE_AREAS,
  ISSUE_DESCRIPTION_MAX,
  ISSUE_DESCRIPTION_MIN,
  ISSUE_IMAGE_PDF_MAX_BYTES,
  ISSUE_MAX_FILES,
  ISSUE_VIDEO_MAX_BYTES,
  type IssueAllowedMime,
  type IssueArea,
} from "@/lib/issues/types";

const EXT_TO_MIME: Record<string, IssueAllowedMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

const ALLOWED_MIME = new Set<string>(ISSUE_ALLOWED_MIME_TYPES);

export function isIssueArea(value: string): value is IssueArea {
  return (ISSUE_AREAS as readonly string[]).includes(value);
}

export function validateIssueArea(value: string): string | null {
  if (!isIssueArea(value)) return "Please choose an area.";
  return null;
}

export function validateIssueDescription(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < ISSUE_DESCRIPTION_MIN) {
    return "Please enter at least 10 characters.";
  }
  if (trimmed.length > ISSUE_DESCRIPTION_MAX) {
    return "Description must be 4000 characters or fewer.";
  }
  return null;
}

export function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function isPdfMime(mime: string): boolean {
  return mime === "application/pdf";
}

export function resolveIssueMimeType(file: { name: string; type: string }): IssueAllowedMime | null {
  const declared = file.type.trim().toLowerCase();
  if (ALLOWED_MIME.has(declared)) return declared as IssueAllowedMime;

  const fromExt = EXT_TO_MIME[extensionOf(file.name)];
  if (fromExt && (!declared || declared === "application/octet-stream")) {
    return fromExt;
  }
  if (fromExt && declared.startsWith("image/") && fromExt.startsWith("image/")) {
    return fromExt;
  }
  return null;
}

export function validateIssueFile(file: { name: string; type: string; size: number }): string | null {
  const mime = resolveIssueMimeType(file);
  if (!mime) {
    return "That file type isn't supported. Please add an image, PDF, or short screen recording.";
  }
  const video = isVideoMime(mime);
  const limit = video ? ISSUE_VIDEO_MAX_BYTES : ISSUE_IMAGE_PDF_MAX_BYTES;
  if (file.size > limit) {
    return video
      ? "Videos must be 50 MB or smaller."
      : "Images and PDFs must be 10 MB or smaller.";
  }
  return null;
}

export function validateIssueFileCount(currentCount: number, incomingCount: number): string | null {
  if (currentCount + incomingCount > ISSUE_MAX_FILES) {
    return `You can attach up to ${ISSUE_MAX_FILES} files.`;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ISSUE_FILE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".pdf",
  ".mp4",
  ".mov",
  ".webm",
].join(",");
