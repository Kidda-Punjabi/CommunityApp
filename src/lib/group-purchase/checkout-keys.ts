import "server-only";

import { packageSlugFromCheckoutKey } from "@/lib/stripe/sync-student-packages-from-payment";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function packageSlugForCheckoutKey(checkoutKey: string): Promise<string | null> {
  return packageSlugFromCheckoutKey(checkoutKey);
}

export async function isGroupPackageCheckoutKey(
  supabase: SupabaseClient,
  checkoutKey: string
): Promise<boolean> {
  const slug = packageSlugFromCheckoutKey(checkoutKey);
  if (!slug) return false;

  const { data, error } = await supabase
    .from("packages")
    .select("delivery_mode")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return false;
  return data?.delivery_mode === "group";
}
