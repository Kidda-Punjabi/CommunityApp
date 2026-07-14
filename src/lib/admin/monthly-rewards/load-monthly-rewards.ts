import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatMonthLabel,
  getCurrentMonthStart,
  getNextMonthStart,
  getPreviousMonthStart,
} from "@/lib/admin/monthly-rewards/month";
import {
  MONTHLY_GIFT_AMOUNTS,
  type MonthlyRewardRank,
  type MonthlyRewardWinnerRow,
  type MonthlyRewardsAttention,
  type MonthlyWinnerPreview,
} from "@/lib/admin/monthly-rewards/types";
import { getDisplayName } from "@/lib/profile/display-name";

type WeeklyPointsRow = {
  user_id: string;
  points: number;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
};

type WinnerDbRow = {
  id: string;
  month_start: string;
  user_id: string;
  rank: number;
  points_total: number;
  gift_card_amount: number | string;
  status: string;
  gift_reference: string | null;
  sent_at: string | null;
  created_at: string;
};

async function loadDisplayNames(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", unique);

  if (error) {
    throw new Error(error.message);
  }

  for (const profile of (data ?? []) as ProfileRow[]) {
    map.set(profile.id, getDisplayName(profile) ?? "Member");
  }

  return map;
}

export async function calculateMonthlyWinners(
  supabase: SupabaseClient,
  monthStart: string
): Promise<{ preview: MonthlyWinnerPreview[]; error?: string }> {
  const rangeEnd = getNextMonthStart(monthStart);

  const { data, error } = await supabase
    .from("weekly_points")
    .select("user_id, points")
    .gte("week_start", monthStart)
    .lt("week_start", rangeEnd)
    .gt("points", 0);

  if (error) {
    return { preview: [], error: error.message };
  }

  const totals = new Map<string, number>();
  for (const row of (data ?? []) as WeeklyPointsRow[]) {
    totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + row.points);
  }

  const ranked = [...totals.entries()]
    .map(([userId, pointsTotal]) => ({ userId, pointsTotal }))
    .sort((a, b) => b.pointsTotal - a.pointsTotal || a.userId.localeCompare(b.userId))
    .slice(0, 3);

  let names: Map<string, string>;
  try {
    names = await loadDisplayNames(
      supabase,
      ranked.map((r) => r.userId)
    );
  } catch (e) {
    return {
      preview: [],
      error: e instanceof Error ? e.message : "Failed to load member names.",
    };
  }

  const preview: MonthlyWinnerPreview[] = ranked.map((row, index) => {
    const rank = (index + 1) as MonthlyRewardRank;
    return {
      userId: row.userId,
      displayName: names.get(row.userId) ?? "Member",
      pointsTotal: row.pointsTotal,
      rank,
      giftCardAmount: MONTHLY_GIFT_AMOUNTS[rank],
    };
  });

  return { preview };
}

export async function loadWinnersForMonth(
  supabase: SupabaseClient,
  monthStart: string
): Promise<{ rows: MonthlyRewardWinnerRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("monthly_reward_winners")
    .select(
      "id, month_start, user_id, rank, points_total, gift_card_amount, status, gift_reference, sent_at, created_at"
    )
    .eq("month_start", monthStart)
    .order("rank", { ascending: true });

  if (error) {
    const message = error.message.includes("schema cache")
      ? `${error.message} Run supabase/monthly-rewards.sql in the Supabase SQL Editor, then retry.`
      : error.message;
    return { rows: [], error: message };
  }

  const dbRows = (data ?? []) as WinnerDbRow[];
  let names: Map<string, string>;
  try {
    names = await loadDisplayNames(
      supabase,
      dbRows.map((r) => r.user_id)
    );
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load member names.",
    };
  }

  return {
    rows: dbRows.map((row) => mapWinnerRow(row, names)),
  };
}

export async function saveMonthlyWinners(
  supabase: SupabaseClient,
  monthStart: string,
  preview: MonthlyWinnerPreview[]
): Promise<{ error?: string }> {
  if (preview.length === 0) {
    return { error: "No winners to save. Calculate winners first." };
  }
  if (preview.length > 3) {
    return { error: "At most 3 winners can be saved." };
  }

  const { count, error: countError } = await supabase
    .from("monthly_reward_winners")
    .select("id", { count: "exact", head: true })
    .eq("month_start", monthStart);

  if (countError) {
    const message = countError.message.includes("schema cache")
      ? `${countError.message} Run supabase/monthly-rewards.sql in the Supabase SQL Editor, then retry.`
      : countError.message;
    return { error: message };
  }

  if ((count ?? 0) > 0) {
    return {
      error: `Winners for ${formatMonthLabel(monthStart)} are already saved. They cannot be overwritten.`,
    };
  }

  const inserts = preview.map((row) => ({
    month_start: monthStart,
    user_id: row.userId,
    rank: row.rank,
    points_total: row.pointsTotal,
    gift_card_amount: MONTHLY_GIFT_AMOUNTS[row.rank],
    status: "pending" as const,
  }));

  const { error } = await supabase.from("monthly_reward_winners").insert(inserts);
  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function markWinnerSent(
  supabase: SupabaseClient,
  id: string,
  giftReference: string
): Promise<{ error?: string }> {
  const trimmed = giftReference.trim();
  if (!trimmed) {
    return { error: "Paste the Prezzee link (or a fulfilment note) before marking as sent." };
  }

  const { error } = await supabase
    .from("monthly_reward_winners")
    .update({
      status: "sent",
      gift_reference: trimmed,
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function loadMonthlyRewardsAttention(
  supabase: SupabaseClient
): Promise<{ attention: MonthlyRewardsAttention; error?: string }> {
  const currentMonth = getCurrentMonthStart();
  const previousMonth = getPreviousMonthStart();

  const { data, error } = await supabase
    .from("monthly_reward_winners")
    .select("id, month_start, status")
    .lt("month_start", currentMonth);

  if (error) {
    const message = error.message.includes("schema cache")
      ? `${error.message} Run supabase/monthly-rewards.sql in the Supabase SQL Editor, then retry.`
      : error.message;
    return {
      attention: { pendingMonths: [], uncalculatedMonth: null },
      error: message,
    };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    month_start: string;
    status: string;
  }>;

  const pendingByMonth = new Map<string, number>();
  const monthsWithAnyRows = new Set<string>();

  for (const row of rows) {
    monthsWithAnyRows.add(row.month_start);
    if (row.status === "pending") {
      pendingByMonth.set(row.month_start, (pendingByMonth.get(row.month_start) ?? 0) + 1);
    }
  }

  const pendingMonths = [...pendingByMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthStart, pendingCount]) => ({
      monthStart,
      monthLabel: formatMonthLabel(monthStart),
      pendingCount,
    }));

  const uncalculatedMonth = monthsWithAnyRows.has(previousMonth)
    ? null
    : {
        monthStart: previousMonth,
        monthLabel: formatMonthLabel(previousMonth),
      };

  return {
    attention: { pendingMonths, uncalculatedMonth },
  };
}

function mapWinnerRow(
  row: WinnerDbRow,
  names: Map<string, string>
): MonthlyRewardWinnerRow {
  const rank = row.rank as MonthlyRewardRank;
  return {
    id: row.id,
    monthStart: row.month_start,
    userId: row.user_id,
    displayName: names.get(row.user_id) ?? "Member",
    rank,
    pointsTotal: row.points_total,
    giftCardAmount: Number(row.gift_card_amount),
    status: row.status === "sent" ? "sent" : "pending",
    giftReference: row.gift_reference,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}
