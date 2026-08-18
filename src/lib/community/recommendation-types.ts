export const CONTENT_TRACKS = ["kids", "adult"] as const;
export type ContentTrack = (typeof CONTENT_TRACKS)[number];

export const MEDIA_TYPES = ["movie", "book"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const RECIPE_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type RecipeDifficulty = (typeof RECIPE_DIFFICULTIES)[number];

export type RecommendedMedia = {
  id: string;
  media_type: MediaType;
  content_track: ContentTrack;
  title: string;
  creator: string | null;
  cefr_level: string | null;
  description: string | null;
  where_to_find: string | null;
  age_appropriate_note: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RecommendedRecipe = {
  id: string;
  title: string;
  punjabi_name: string | null;
  description: string | null;
  difficulty: RecipeDifficulty | null;
  prep_time_minutes: number | null;
  external_link: string | null;
  content_track: ContentTrack;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TutorFavoriteRow = {
  id: string;
  tutor_id: string;
  media_id: string | null;
  recipe_id: string | null;
  note: string | null;
  created_at: string;
};

export type TutorPickItem = {
  favoriteId: string;
  kind: "media" | "recipe";
  title: string;
  note: string | null;
  contentTrack: ContentTrack;
  mediaType?: MediaType;
  creator?: string | null;
  cefrLevel?: string | null;
  description?: string | null;
  whereToFind?: string | null;
  ageAppropriateNote?: string | null;
  punjabiName?: string | null;
  difficulty?: RecipeDifficulty | null;
  prepTimeMinutes?: number | null;
  externalLink?: string | null;
};

export type TutorPickGroup = {
  tutorId: string;
  tutorName: string;
  items: TutorPickItem[];
};

export function mediaTypeLabel(type: MediaType): string {
  return type === "movie" ? "Movie" : "Book";
}

export function contentTrackLabel(track: ContentTrack): string {
  return track === "kids" ? "Kids" : "Adult";
}

export function recipeDifficultyLabel(value: RecipeDifficulty | null): string | null {
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
