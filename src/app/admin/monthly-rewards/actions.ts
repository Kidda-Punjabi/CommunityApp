"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import {
  calculateMonthlyWinners,
  loadMonthlyRewardsAttention,
  loadWinnersForMonth,
  markWinnerSent,
  saveMonthlyWinners,
} from "@/lib/admin/monthly-rewards/load-monthly-rewards";
import { normalizeMonthStart } from "@/lib/admin/monthly-rewards/month";
import type {
  MonthlyRewardWinnerRow,
  MonthlyRewardsAttention,
  MonthlyWinnerPreview,
} from "@/lib/admin/monthly-rewards/types";
import { revalidatePath } from "next/cache";

const MONTHLY_REWARDS_PATH = "/admin/monthly-rewards";
const ADMIN_HOME_PATH = "/admin/content";

function parseMonth(monthStart: string): string | null {
  return normalizeMonthStart(monthStart);
}

export async function fetchMonthlyWinnersForMonth(monthStart: string): Promise<{
  rows: MonthlyRewardWinnerRow[];
  error?: string;
}> {
  try {
    const normalized = parseMonth(monthStart);
    if (!normalized) return { rows: [], error: "Invalid month." };
    const supabase = await requireAdminFromActions();
    return loadWinnersForMonth(supabase, normalized);
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load winners.",
    };
  }
}

export async function calculateMonthlyWinnersAction(monthStart: string): Promise<{
  preview: MonthlyWinnerPreview[];
  error?: string;
}> {
  try {
    const normalized = parseMonth(monthStart);
    if (!normalized) return { preview: [], error: "Invalid month." };
    const supabase = await requireAdminFromActions();
    return calculateMonthlyWinners(supabase, normalized);
  } catch (e) {
    return {
      preview: [],
      error: e instanceof Error ? e.message : "Failed to calculate winners.",
    };
  }
}

export async function confirmMonthlyWinnersAction(
  monthStart: string,
  preview: MonthlyWinnerPreview[]
): Promise<ActionResult> {
  try {
    const normalized = parseMonth(monthStart);
    if (!normalized) return { error: "Invalid month." };
    const supabase = await requireAdminFromActions();
    const result = await saveMonthlyWinners(supabase, normalized, preview);
    if (result.error) return { error: result.error };
    revalidatePath(MONTHLY_REWARDS_PATH);
    revalidatePath(ADMIN_HOME_PATH);
    return { success: "Winners saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save winners." };
  }
}

export async function markMonthlyWinnerSentAction(
  id: string,
  giftReference: string
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const result = await markWinnerSent(supabase, id, giftReference);
    if (result.error) return { error: result.error };
    revalidatePath(MONTHLY_REWARDS_PATH);
    revalidatePath(ADMIN_HOME_PATH);
    return { success: "Marked as sent." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update winner." };
  }
}

export async function fetchMonthlyRewardsAttention(): Promise<{
  attention: MonthlyRewardsAttention;
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return loadMonthlyRewardsAttention(supabase);
  } catch (e) {
    return {
      attention: { pendingMonths: [], uncalculatedMonth: null },
      error: e instanceof Error ? e.message : "Failed to load monthly rewards alerts.",
    };
  }
}
