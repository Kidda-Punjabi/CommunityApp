import { getPublicAppUrl } from "@/lib/app-url";

export const REFERRAL_COOKIE_NAME = "kidda_ref";

export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type ReferralStatus = "pending" | "qualified";

export function normalizeReferralCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function getReferralShareUrl(code: string): string {
  return `${getPublicAppUrl()}/signup?ref=${encodeURIComponent(code)}`;
}

export function referralStatusLabel(status: ReferralStatus): string {
  switch (status) {
    case "pending":
      return "Signed up";
    case "qualified":
      return "Active";
  }
}
