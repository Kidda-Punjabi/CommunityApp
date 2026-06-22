import type { BrandingAssetType } from "./types";

const MAX_BYTES = 2 * 1024 * 1024;

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const ICON_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const FAVICON_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function extensionForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/svg+xml") return "svg";
  if (type === "image/x-icon" || type === "image/vnd.microsoft.icon") return "ico";
  return "jpg";
}

export function extensionForBrandingFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "ico" && FAVICON_TYPES.has(file.type)) return "ico";
  return extensionForType(file.type);
}

export function validateBrandingFile(assetType: BrandingAssetType, file: File): string | null {
  const allowed =
    assetType === "logo"
      ? LOGO_TYPES
      : assetType === "icon"
        ? ICON_TYPES
        : FAVICON_TYPES;

  if (!allowed.has(file.type)) {
    if (assetType === "favicon") {
      return "Favicon must be PNG, JPG, WebP, SVG, or ICO.";
    }
    return "Image must be PNG, JPG, WebP, or SVG.";
  }

  if (file.size > MAX_BYTES) {
    return "Image must be 2 MB or smaller.";
  }

  return null;
}
