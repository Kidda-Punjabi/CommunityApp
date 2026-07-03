import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadCoinBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("coin_balance")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load coin balance:", error.message);
    return 0;
  }

  return data?.coin_balance ?? 0;
}

/** Best-effort award — returns new balance or null on failure. */
export async function awardCoins(
  supabase: SupabaseClient,
  amount: number
): Promise<number | null> {
  if (amount <= 0) return null;

  const { data, error } = await supabase.rpc("award_coins", { p_coins: amount });

  if (error) {
    console.error("Failed to award coins:", error.message);
    return null;
  }

  return typeof data === "number" ? data : null;
}
