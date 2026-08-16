export const KID_PROFILE_COOKIE = "kidda_kid_profile_id";
export const KIDS_PIN_UNLOCKED_COOKIE = "kidda_kids_pin_unlocked";
/** Session-scoped: set after the post-login picker so we do not re-prompt this tab. */
export const WHO_IS_LEARNING_COOKIE = "kidda_who_is_learning";

export const KID_AVATAR_ICONS = [
  "Cat",
  "Dog",
  "Rabbit",
  "Bird",
  "Fish",
  "Rocket",
  "Star",
  "Rainbow",
  "Sun",
  "Moon",
  "Heart",
  "Flower2",
] as const;

export type KidAvatarIcon = (typeof KID_AVATAR_ICONS)[number];

export const KID_AGE_TIERS = [
  { value: "pre_reader" as const, label: "Pre-reader (3–6)", description: "Pictures and audio, minimal reading" },
  { value: "early_reader" as const, label: "Early reader (7–10)", description: "Simple text games and flashcards" },
  { value: "independent" as const, label: "Independent (11+)", description: "Full app experience (no forum)" },
];

export type KidAgeTier = (typeof KID_AGE_TIERS)[number]["value"];

/**
 * Free-taste bedtime stories for parents without Premium.
 * Matches DB rows with `is_premium = false` (5 of 30).
 */
export const FREE_KID_STORY_TASTE_COUNT = 5;

/** Kid-friendly flashcard topic_tags (case-insensitive match). */
export const KID_FRIENDLY_TOPIC_TAGS = [
  "Animals",
  "Colours",
  "Colors",
  "Family",
  "Food",
  "Nature",
  "Shapes",
  "Body",
] as const;

export const STICKER_CATALOG = [
  { icon: "Star", name: "Shining Star" },
  { icon: "Heart", name: "Big Heart" },
  { icon: "Sun", name: "Sunny Day" },
  { icon: "Moon", name: "Moonbeam" },
  { icon: "Rainbow", name: "Rainbow" },
  { icon: "Flower2", name: "Pretty Flower" },
  { icon: "Cat", name: "Cool Cat" },
  { icon: "Dog", name: "Happy Dog" },
  { icon: "Rabbit", name: "Bouncy Bunny" },
  { icon: "Bird", name: "Singing Bird" },
  { icon: "Fish", name: "Splish Fish" },
  { icon: "Rocket", name: "Blast Off" },
  { icon: "Sparkles", name: "Sparkles" },
  { icon: "Trophy", name: "Champion" },
  { icon: "Medal", name: "Gold Medal" },
  { icon: "Crown", name: "Royal Crown" },
  { icon: "Gem", name: "Shiny Gem" },
  { icon: "Music", name: "Music Note" },
  { icon: "Smile", name: "Happy Face" },
  { icon: "ThumbsUp", name: "Great Job" },
  { icon: "PartyPopper", name: "Party Time" },
  { icon: "Balloon", name: "Balloon" },
  { icon: "Cake", name: "Yummy Cake" },
  { icon: "Apple", name: "Crunchy Apple" },
  { icon: "Cherry", name: "Cherry" },
  { icon: "TreePine", name: "Pine Tree" },
  { icon: "Cloud", name: "Fluffy Cloud" },
  { icon: "Zap", name: "Lightning" },
  { icon: "Wand2", name: "Magic Wand" },
  { icon: "Footprints", name: "Footprints" },
] as const;

export type StickerCatalogEntry = (typeof STICKER_CATALOG)[number];

export const KID_ACTIVITY_TYPES = {
  flashcard_study: "Flashcard practice",
  memory_match: "Memory match",
  speaking_practice: "Speaking practice",
} as const;

export type KidActivityType = keyof typeof KID_ACTIVITY_TYPES;

export function isKidAvatarIcon(value: string): value is KidAvatarIcon {
  return (KID_AVATAR_ICONS as readonly string[]).includes(value);
}

export function isKidAgeTier(value: string): value is KidAgeTier {
  return value === "pre_reader" || value === "early_reader" || value === "independent";
}

export function usesKidsShell(ageTier: KidAgeTier): boolean {
  return ageTier === "pre_reader" || ageTier === "early_reader";
}

export function tagMatchesKidFriendly(tags: string[] | null | undefined): boolean {
  if (!tags?.length) return false;
  const normalized = new Set(tags.map((t) => t.toLowerCase()));
  return KID_FRIENDLY_TOPIC_TAGS.some((tag) => normalized.has(tag.toLowerCase()));
}
