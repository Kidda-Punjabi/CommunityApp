import "server-only";

import { getDisplayName } from "@/lib/profile/display-name";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RecommendedMedia,
  RecommendedRecipe,
  TutorFavoriteRow,
  TutorPickGroup,
  TutorPickItem,
} from "@/lib/community/recommendation-types";

export type {
  ContentTrack,
  MediaType,
  RecipeDifficulty,
  RecommendedMedia,
  RecommendedRecipe,
  TutorFavoriteRow,
  TutorPickGroup,
  TutorPickItem,
} from "@/lib/community/recommendation-types";
export {
  CONTENT_TRACKS,
  MEDIA_TYPES,
  RECIPE_DIFFICULTIES,
  contentTrackLabel,
  mediaTypeLabel,
  recipeDifficultyLabel,
} from "@/lib/community/recommendation-types";

const INACTIVE_COHORT_STATUSES = [
  "postponed",
  "incomplete",
  "classes_completed",
  "offboarding_complete",
];

type CohortEmbed = {
  id: string;
  tutor_id: string | null;
  active: boolean | null;
  status: string | null;
} | null;

function unwrapCohort(raw: unknown): CohortEmbed {
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? null) as CohortEmbed;
}

function unwrapOne<T>(raw: unknown): T | null {
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? null) as T | null;
}

function isCurrentCohort(cohort: CohortEmbed): boolean {
  if (!cohort) return true;
  if (cohort.active === false) return false;
  if (cohort.status && INACTIVE_COHORT_STATUSES.includes(cohort.status)) return false;
  return true;
}

export async function loadRecommendedCatalog(
  supabase: SupabaseClient,
  options?: { includeInactive?: boolean }
): Promise<{ media: RecommendedMedia[]; recipes: RecommendedRecipe[] }> {
  let mediaQuery = supabase
    .from("recommended_media")
    .select("*")
    .order("display_order")
    .order("title");
  let recipeQuery = supabase
    .from("recommended_recipes")
    .select("*")
    .order("display_order")
    .order("title");

  if (!options?.includeInactive) {
    mediaQuery = mediaQuery.eq("is_active", true);
    recipeQuery = recipeQuery.eq("is_active", true);
  }

  const [mediaResult, recipeResult] = await Promise.all([mediaQuery, recipeQuery]);
  if (mediaResult.error) throw mediaResult.error;
  if (recipeResult.error) throw recipeResult.error;

  return {
    media: (mediaResult.data ?? []) as RecommendedMedia[],
    recipes: (recipeResult.data ?? []) as RecommendedRecipe[],
  };
}

export async function loadTutorFavorites(
  supabase: SupabaseClient,
  tutorId: string
): Promise<TutorFavoriteRow[]> {
  const { data, error } = await supabase
    .from("tutor_favorites")
    .select("id, tutor_id, media_id, recipe_id, note, created_at")
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TutorFavoriteRow[];
}

async function loadStudentTutorIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const actor = await resolveCourseActor(supabase, userId);

  const [enrollmentsResult, membersResult] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("tutor_id, cohort_id, kid_profile_id, cohorts(id, tutor_id, active, status)")
      .eq("user_id", userId),
    supabase
      .from("cohort_members")
      .select("cohort_id, kid_profile_id, cohorts(id, tutor_id, active, status)")
      .eq("user_id", userId)
      .is("left_at", null),
  ]);

  if (enrollmentsResult.error) throw enrollmentsResult.error;
  if (membersResult.error) throw membersResult.error;

  const matchesActor = (kidProfileId: string | null) =>
    actor.kind === "kid" ? kidProfileId === actor.kidProfileId : !kidProfileId;

  const tutorIds = new Set<string>();

  for (const row of enrollmentsResult.data ?? []) {
    if (!matchesActor((row.kid_profile_id as string | null) ?? null)) continue;
    const cohort = unwrapCohort(row.cohorts);
    if (row.cohort_id && !isCurrentCohort(cohort)) continue;
    const tutorId = (cohort?.tutor_id as string | null) || (row.tutor_id as string | null);
    if (tutorId) tutorIds.add(tutorId);
  }

  for (const row of membersResult.data ?? []) {
    if (!matchesActor((row.kid_profile_id as string | null) ?? null)) continue;
    const cohort = unwrapCohort(row.cohorts);
    if (!isCurrentCohort(cohort)) continue;
    const tutorId = cohort?.tutor_id as string | null;
    if (tutorId) tutorIds.add(tutorId);
  }

  return [...tutorIds];
}

function toPickItem(row: {
  id: string;
  note: string | null;
  recommended_media: unknown;
  recommended_recipes: unknown;
}): TutorPickItem | null {
  const media = unwrapOne<RecommendedMedia>(row.recommended_media);
  if (media?.is_active !== false && media?.title) {
    return {
      favoriteId: row.id,
      kind: "media",
      title: media.title,
      note: row.note,
      contentTrack: media.content_track,
      mediaType: media.media_type,
      creator: media.creator,
      cefrLevel: media.cefr_level,
      description: media.description,
      whereToFind: media.where_to_find,
      ageAppropriateNote: media.age_appropriate_note,
    };
  }

  const recipe = unwrapOne<RecommendedRecipe>(row.recommended_recipes);
  if (recipe?.is_active !== false && recipe?.title) {
    return {
      favoriteId: row.id,
      kind: "recipe",
      title: recipe.title,
      note: row.note,
      contentTrack: recipe.content_track,
      punjabiName: recipe.punjabi_name,
      difficulty: recipe.difficulty,
      prepTimeMinutes: recipe.prep_time_minutes,
      externalLink: recipe.external_link,
      description: recipe.description,
    };
  }

  return null;
}

export async function loadTutorPicksForStudent(
  supabase: SupabaseClient,
  userId: string
): Promise<TutorPickGroup[]> {
  const tutorIds = await loadStudentTutorIds(supabase, userId);
  if (tutorIds.length === 0) return [];

  const [favoritesResult, profilesResult] = await Promise.all([
    supabase
      .from("tutor_favorites")
      .select(
        "id, tutor_id, note, created_at, recommended_media(*), recommended_recipes(*)"
      )
      .in("tutor_id", tutorIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in("id", tutorIds),
  ]);

  if (favoritesResult.error) throw favoritesResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const nameById = new Map<string, string>();
  for (const profile of profilesResult.data ?? []) {
    nameById.set(profile.id as string, getDisplayName(profile) ?? "Your tutor");
  }

  const itemsByTutor = new Map<string, TutorPickItem[]>();
  for (const tutorId of tutorIds) {
    itemsByTutor.set(tutorId, []);
  }

  for (const row of favoritesResult.data ?? []) {
    const item = toPickItem(
      row as {
        id: string;
        note: string | null;
        recommended_media: unknown;
        recommended_recipes: unknown;
      }
    );
    if (!item) continue;
    const tutorId = row.tutor_id as string;
    const list = itemsByTutor.get(tutorId);
    if (list) list.push(item);
    else itemsByTutor.set(tutorId, [item]);
  }

  return tutorIds.map((tutorId) => ({
    tutorId,
    tutorName: nameById.get(tutorId) ?? "Your tutor",
    items: itemsByTutor.get(tutorId) ?? [],
  }));
}
