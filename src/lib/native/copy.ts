export const NATIVE_LOCKED_MESSAGE = "This course isn't on your account.";
export const NATIVE_GAME_LOCKED_MESSAGE = "Not included in your membership";

const PURCHASE_LANGUAGE =
  /\b(buy|buying|bought|purchase|purchases|purchased|premium|checkout|upgrade|subscribe|subscription|billing|price|prices|discount|refund|promo)\b|£|book a call|sign up|create account/i;

export function containsPurchaseLanguage(value: string | null | undefined): boolean {
  if (!value) return false;
  return PURCHASE_LANGUAGE.test(value);
}
