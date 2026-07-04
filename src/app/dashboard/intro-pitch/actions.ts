"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function dismissIntroPitch(isTestMode = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not signed in." };

  if (isTestMode) {
    return { success: true };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      has_seen_intro_pitch: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("has_seen_intro_pitch")) {
      return {
        error:
          "The has_seen_intro_pitch column is missing. Run supabase/intro-pitch-onboarding.sql in the Supabase SQL Editor.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");

  return { success: true };
}
