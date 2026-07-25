/** Monthly Live Translate conversation caps by Premium membership. */
export const LIVE_TRANSLATE_FREE_MONTHLY_CAP_SECONDS = 5 * 60;
export const LIVE_TRANSLATE_PREMIUM_MONTHLY_CAP_SECONDS = 15 * 60;

/** @deprecated Use liveTranslateCapForPremium — kept for older imports. */
export const LIVE_TRANSLATE_MONTHLY_CAP_SECONDS =
  LIVE_TRANSLATE_PREMIUM_MONTHLY_CAP_SECONDS;

export const LIVE_TRANSLATE_PATH = "/dashboard/live-translate";

export type LiveTranslateSide = "member" | "other";

export type LiveTranslateDirection = "en-to-pa" | "pa-to-en";

export function liveTranslateCapForPremium(isPremium: boolean): number {
  return isPremium
    ? LIVE_TRANSLATE_PREMIUM_MONTHLY_CAP_SECONDS
    : LIVE_TRANSLATE_FREE_MONTHLY_CAP_SECONDS;
}

export function liveTranslateCapMinutes(isPremium: boolean): number {
  return liveTranslateCapForPremium(isPremium) / 60;
}
