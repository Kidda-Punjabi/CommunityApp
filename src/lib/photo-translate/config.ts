/** Monthly Photo Translate scan caps by Premium membership. */
export const PHOTO_TRANSLATE_FREE_MONTHLY_CAP_SCANS = 5;
export const PHOTO_TRANSLATE_PREMIUM_MONTHLY_CAP_SCANS = 30;

/** @deprecated Prefer photoTranslateCapForPremium — kept for transitional imports. */
export const PHOTO_TRANSLATE_MONTHLY_CAP_SCANS =
  PHOTO_TRANSLATE_FREE_MONTHLY_CAP_SCANS;

export const PHOTO_TRANSLATE_PATH = "/dashboard/photo-translate";

export const PHOTO_TRANSLATE_MAX_IMAGE_EDGE_PX = 1500;

export const PHOTO_TRANSLATE_JPEG_QUALITY = 0.85;

export function photoTranslateCapForPremium(isPremium: boolean): number {
  return isPremium
    ? PHOTO_TRANSLATE_PREMIUM_MONTHLY_CAP_SCANS
    : PHOTO_TRANSLATE_FREE_MONTHLY_CAP_SCANS;
}
