import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getShareAppUrl } from "@/lib/app-url-server";
import { getReferralShareUrl } from "@/lib/app-url";
import {
  type ReferralStatus,
} from "@/lib/referrals/constants";

export type ReferralListItem = {
  id: string;
  status: ReferralStatus;
  signedUpAt: string;
  qualifiedAt: string | null;
  referredDisplayName: string;
};

export type ReferralUnavailableReason = "migration_required" | "setup_failed";

export type ReferralProfileData = {
  referralCode: string | null;
  shareUrl: string | null;
  referrals: ReferralListItem[];
  unavailableReason?: ReferralUnavailableReason;
};

type ReferredProfile = {
  full_name: string | null;
  preferred_name: string | null;
};

type ReferralRow = {
  id: string;
  status: ReferralStatus;
  signed_up_at: string;
  qualified_at: string | null;
  referred: ReferredProfile | ReferredProfile[] | null;
};

function referredProfile(row: ReferralRow): ReferredProfile | null {
  if (!row.referred) return null;
  return Array.isArray(row.referred) ? (row.referred[0] ?? null) : row.referred;
}

function isMissingReferralSchema(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("referral_code") && lower.includes("column")) ||
    lower.includes("ensure_my_referral_code") ||
    lower.includes("relation \"referrals\" does not exist")
  );
}

async function loadReferralCode(
  supabase: SupabaseClient,
  userId: string
): Promise<{ code: string | null; unavailableReason?: ReferralUnavailableReason }> {
  const ensured = await supabase.rpc("ensure_my_referral_code");
  if (!ensured.error && ensured.data) {
    const code = String(ensured.data).trim();
    if (code) {
      return { code };
    }
  }

  if (ensured.error && isMissingReferralSchema(ensured.error.message)) {
    return { code: null, unavailableReason: "migration_required" };
  }

  const selected = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if (selected.error) {
    if (isMissingReferralSchema(selected.error.message)) {
      return { code: null, unavailableReason: "migration_required" };
    }
    return { code: null, unavailableReason: "setup_failed" };
  }

  const code = selected.data?.referral_code?.trim();
  if (code) {
    return { code };
  }

  return { code: null, unavailableReason: "setup_failed" };
}

async function loadReferralsMade(
  supabase: SupabaseClient,
  userId: string
): Promise<ReferralListItem[]> {
  const referralsResult = await supabase
    .from("referrals")
    .select(
      `
      id,
      status,
      signed_up_at,
      qualified_at,
      referred:referred_user_id (
        full_name,
        preferred_name
      )
    `
    )
    .eq("referrer_user_id", userId)
    .order("signed_up_at", { ascending: false });

  if (referralsResult.error) {
    return [];
  }

  const referrals = (referralsResult.data ?? []) as ReferralRow[];

  return referrals.map((row) => ({
    id: row.id,
    status: row.status,
    signedUpAt: row.signed_up_at,
    qualifiedAt: row.qualified_at,
    referredDisplayName: getDisplayName(referredProfile(row)) ?? "Friend",
  }));
}

export async function loadReferralProfileData(
  supabase: SupabaseClient,
  userId: string
): Promise<ReferralProfileData> {
  const [appUrl, { code, unavailableReason }, referrals] = await Promise.all([
    getShareAppUrl(),
    loadReferralCode(supabase, userId),
    loadReferralsMade(supabase, userId),
  ]);

  return {
    referralCode: code,
    shareUrl: code ? getReferralShareUrl(code, appUrl) : null,
    referrals,
    unavailableReason,
  };
}
