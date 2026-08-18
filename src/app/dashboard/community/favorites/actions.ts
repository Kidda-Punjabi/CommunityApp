"use server";

import { createClient } from "@/lib/supabase/server";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { revalidatePath } from "next/cache";

export type FavoriteActionResult = { error?: string; success?: string };

const NOTE_MAX = 280;

async function requireTutor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) throw new Error("Tutor access required.");

  return { supabase, userId: user.id };
}

function revalidateFavoritePaths() {
  revalidatePath("/dashboard/community");
  revalidatePath("/dashboard/community/favorites");
  revalidatePath("/dashboard/community/picks");
}

function parseTarget(formData: FormData): {
  mediaId: string | null;
  recipeId: string | null;
} | { error: string } {
  const mediaId = String(formData.get("media_id") ?? "").trim() || null;
  const recipeId = String(formData.get("recipe_id") ?? "").trim() || null;
  if ((mediaId && recipeId) || (!mediaId && !recipeId)) {
    return { error: "Choose a movie/book or a recipe." };
  }
  return { mediaId, recipeId };
}

export async function setTutorFavorite(
  _prev: FavoriteActionResult,
  formData: FormData
): Promise<FavoriteActionResult> {
  try {
    const { supabase, userId } = await requireTutor();
    const target = parseTarget(formData);
    if ("error" in target) return { error: target.error };

    const noteRaw = String(formData.get("note") ?? "").trim();
    const note = noteRaw ? noteRaw.slice(0, NOTE_MAX) : null;
    const favorited = formData.get("favorited") === "true";

    const existingQuery = supabase
      .from("tutor_favorites")
      .select("id")
      .eq("tutor_id", userId);
    const { data: existing, error: existingError } = target.mediaId
      ? await existingQuery.eq("media_id", target.mediaId).maybeSingle()
      : await existingQuery.eq("recipe_id", target.recipeId!).maybeSingle();

    if (existingError) return { error: existingError.message };

    if (!favorited) {
      if (existing?.id) {
        const { error } = await supabase.from("tutor_favorites").delete().eq("id", existing.id);
        if (error) return { error: error.message };
      }
      revalidateFavoritePaths();
      return { success: "Removed from your favorites." };
    }

    if (existing?.id) {
      const { error } = await supabase
        .from("tutor_favorites")
        .update({ note })
        .eq("id", existing.id);
      if (error) return { error: error.message };
      revalidateFavoritePaths();
      return { success: "Favorite updated." };
    }

    const { error } = await supabase.from("tutor_favorites").insert({
      tutor_id: userId,
      media_id: target.mediaId,
      recipe_id: target.recipeId,
      note,
    });
    if (error) return { error: error.message };

    revalidateFavoritePaths();
    return { success: "Saved to your favorites." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update favorite." };
  }
}
