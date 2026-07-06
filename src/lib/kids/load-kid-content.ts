import { tagMatchesKidFriendly, usesKidsShell, type KidAgeTier } from "@/lib/kids/constants";
import type { KidProfile } from "@/lib/kids/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadKidFriendlyFlashcards(supabase: SupabaseClient, limit = 40) {
  const { data } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, icon_name, topic_tags, audio_url")
    .eq("category", "vocab")
    .not("icon_name", "is", null)
    .limit(500);

  const filtered = (data ?? []).filter((row) =>
    tagMatchesKidFriendly(row.topic_tags as string[] | null)
  );

  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

export function kidForumBlocked(activeKidProfile: KidProfile | null): boolean {
  return activeKidProfile !== null;
}

export function kidUsesStickerRewards(ageTier: KidAgeTier): boolean {
  return usesKidsShell(ageTier);
}

export function kidHomeHref(ageTier: KidAgeTier): string {
  return usesKidsShell(ageTier) ? "/dashboard/kids" : "/dashboard/home";
}

export function assertKidProfileOwnership(
  profile: KidProfile | null,
  parentUserId: string
): profile is KidProfile {
  return profile !== null && profile.parent_user_id === parentUserId;
}
