"use server";

import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import {
  CONTENT_TRACKS,
  MEDIA_TYPES,
  RECIPE_DIFFICULTIES,
  type ContentTrack,
  type MediaType,
  type RecipeDifficulty,
} from "@/lib/community/recommendation-types";
import { revalidatePath } from "next/cache";

export type RecommendationActionResult = { error?: string; success?: string };

const ADMIN_SITE_PATH = "/admin/content/site";
const COMMUNITY_PATH = "/dashboard/community";
const COMMUNITY_PICKS_PATH = "/dashboard/community/picks";
const COMMUNITY_FAVORITES_PATH = "/dashboard/community/favorites";

async function requireAdmin() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user || !(await canAccessAdminPanel(user, authClient))) {
    throw new Error("Unauthorized");
  }

  return createServiceRoleClient();
}

function revalidateRecommendationPaths() {
  revalidatePath(ADMIN_SITE_PATH);
  revalidatePath(COMMUNITY_PATH);
  revalidatePath(COMMUNITY_PICKS_PATH);
  revalidatePath(COMMUNITY_FAVORITES_PATH);
}

function withDbHint(message: string): string {
  if (message.includes("schema cache") || message.includes("does not exist")) {
    return `${message} Run supabase/recommended-catalog.sql, then retry.`;
  }
  return message;
}

function textOrNull(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value : null;
}

function requiredText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function parseTrack(formData: FormData): ContentTrack | null {
  const value = String(formData.get("content_track") ?? "");
  return (CONTENT_TRACKS as readonly string[]).includes(value)
    ? (value as ContentTrack)
    : null;
}

function parseMediaType(formData: FormData): MediaType | null {
  const value = String(formData.get("media_type") ?? "");
  return (MEDIA_TYPES as readonly string[]).includes(value) ? (value as MediaType) : null;
}

function parseDifficulty(formData: FormData): RecipeDifficulty | null {
  const value = String(formData.get("difficulty") ?? "").trim();
  if (!value) return null;
  return (RECIPE_DIFFICULTIES as readonly string[]).includes(value)
    ? (value as RecipeDifficulty)
    : null;
}

function parseIntOrNull(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

function parseDisplayOrder(formData: FormData): number {
  return parseIntOrNull(formData, "display_order") ?? 0;
}

function parseIsActive(formData: FormData): boolean {
  return formData.getAll("is_active").includes("true");
}

function parseMediaForm(formData: FormData) {
  return {
    media_type: parseMediaType(formData),
    content_track: parseTrack(formData),
    title: requiredText(formData, "title"),
    creator: textOrNull(formData, "creator"),
    cefr_level: textOrNull(formData, "cefr_level"),
    description: textOrNull(formData, "description"),
    where_to_find: textOrNull(formData, "where_to_find"),
    age_appropriate_note: textOrNull(formData, "age_appropriate_note"),
    display_order: parseDisplayOrder(formData),
    is_active: parseIsActive(formData),
  };
}

function parseRecipeForm(formData: FormData) {
  return {
    title: requiredText(formData, "title"),
    punjabi_name: textOrNull(formData, "punjabi_name"),
    description: textOrNull(formData, "description"),
    difficulty: parseDifficulty(formData),
    prep_time_minutes: parseIntOrNull(formData, "prep_time_minutes"),
    external_link: textOrNull(formData, "external_link"),
    content_track: parseTrack(formData),
    display_order: parseDisplayOrder(formData),
    is_active: parseIsActive(formData),
  };
}

export async function createRecommendedMedia(
  _prev: RecommendationActionResult,
  formData: FormData
): Promise<RecommendationActionResult> {
  try {
    const supabase = await requireAdmin();
    const media = parseMediaForm(formData);
    if (!media.title || !media.media_type || !media.content_track) {
      return { error: "Title, type, and track are required." };
    }

    const { error } = await supabase.from("recommended_media").insert(media);
    if (error) return { error: withDbHint(error.message) };

    revalidateRecommendationPaths();
    return { success: "Media recommendation added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add media." };
  }
}

export async function updateRecommendedMedia(
  _prev: RecommendationActionResult,
  formData: FormData
): Promise<RecommendationActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const media = parseMediaForm(formData);
    if (!id || !media.title || !media.media_type || !media.content_track) {
      return { error: "Title, type, and track are required." };
    }

    const { error } = await supabase.from("recommended_media").update(media).eq("id", id);
    if (error) return { error: withDbHint(error.message) };

    revalidateRecommendationPaths();
    return { success: "Media recommendation updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update media." };
  }
}

export async function deleteRecommendedMedia(id: string): Promise<RecommendationActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("recommended_media").delete().eq("id", id);
    if (error) return { error: withDbHint(error.message) };
    revalidateRecommendationPaths();
    return { success: "Media recommendation deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete media." };
  }
}

export async function createRecommendedRecipe(
  _prev: RecommendationActionResult,
  formData: FormData
): Promise<RecommendationActionResult> {
  try {
    const supabase = await requireAdmin();
    const recipe = parseRecipeForm(formData);
    if (!recipe.title || !recipe.content_track) {
      return { error: "Title and track are required." };
    }

    const { error } = await supabase.from("recommended_recipes").insert(recipe);
    if (error) return { error: withDbHint(error.message) };

    revalidateRecommendationPaths();
    return { success: "Recipe added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add recipe." };
  }
}

export async function updateRecommendedRecipe(
  _prev: RecommendationActionResult,
  formData: FormData
): Promise<RecommendationActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const recipe = parseRecipeForm(formData);
    if (!id || !recipe.title || !recipe.content_track) {
      return { error: "Title and track are required." };
    }

    const { error } = await supabase.from("recommended_recipes").update(recipe).eq("id", id);
    if (error) return { error: withDbHint(error.message) };

    revalidateRecommendationPaths();
    return { success: "Recipe updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update recipe." };
  }
}

export async function deleteRecommendedRecipe(id: string): Promise<RecommendationActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("recommended_recipes").delete().eq("id", id);
    if (error) return { error: withDbHint(error.message) };
    revalidateRecommendationPaths();
    return { success: "Recipe deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete recipe." };
  }
}
