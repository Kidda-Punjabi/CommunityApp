"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { revalidatePath } from "next/cache";

const ADMIN_PATH = "/admin/content/kids-stories";

export type AdminKidBedtimeStory = {
  id: string;
  title: string;
  audio_asset_id: string | null;
  age_tier: string;
  is_premium: boolean;
  display_order: number;
};

export async function listAdminKidBedtimeStories(): Promise<{
  stories: AdminKidBedtimeStory[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    const { data, error } = await supabase
      .from("kid_bedtime_stories")
      .select("id, title, audio_asset_id, age_tier, is_premium, display_order")
      .order("display_order", { ascending: true });

    if (error) {
      if (error.message.includes("kid_bedtime_stories")) {
        return {
          stories: [],
          error:
            "Run supabase/premium-subscription.sql in the Supabase SQL Editor to create kid_bedtime_stories.",
        };
      }
      return { stories: [], error: error.message };
    }

    return { stories: (data ?? []) as AdminKidBedtimeStory[] };
  } catch (e) {
    return {
      stories: [],
      error: e instanceof Error ? e.message : "Failed to load stories.",
    };
  }
}

export async function createAdminKidBedtimeStory(
  formData: FormData
): Promise<void> {
  try {
    const supabase = await requireAdminFromActions();
    const title = String(formData.get("title") ?? "").trim();
    const ageTier = String(formData.get("age_tier") ?? "all").trim();
    const audioAssetId = String(formData.get("audio_asset_id") ?? "").trim() || null;
    const isPremium = formData.get("is_premium") === "on";
    const displayOrder = Number(formData.get("display_order") ?? 0) || 0;

    if (!title) return;

    const { error } = await supabase.from("kid_bedtime_stories").insert({
      title,
      age_tier: ageTier,
      audio_asset_id: audioAssetId,
      is_premium: isPremium,
      display_order: displayOrder,
    });

    if (error) {
      console.error("[kids-stories] create failed:", error.message);
      return;
    }
    revalidatePath(ADMIN_PATH);
  } catch (e) {
    console.error("[kids-stories] create failed:", e);
  }
}

export async function deleteAdminKidBedtimeStory(
  formData: FormData
): Promise<void> {
  try {
    const supabase = await requireAdminFromActions();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    const { error } = await supabase.from("kid_bedtime_stories").delete().eq("id", id);
    if (error) {
      console.error("[kids-stories] delete failed:", error.message);
      return;
    }
    revalidatePath(ADMIN_PATH);
  } catch (e) {
    console.error("[kids-stories] delete failed:", e);
  }
}
