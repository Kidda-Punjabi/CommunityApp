import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentWeekStart } from "@/lib/leaderboard/week";

export type FeaturedTestimonial = {
  id: string;
  quote: string;
  authorName: string;
  contextLine: string;
};

type TestimonialRow = {
  id: string;
  quote: string;
  author_name: string;
  context_line: string;
  featured_week: string | null;
  is_active: boolean;
};

function mapRow(row: TestimonialRow): FeaturedTestimonial {
  return {
    id: row.id,
    quote: row.quote,
    authorName: row.author_name,
    contextLine: row.context_line,
  };
}

export async function loadFeaturedTestimonial(
  supabase: SupabaseClient
): Promise<FeaturedTestimonial | null> {
  const currentWeekStart = getCurrentWeekStart();

  const { data: weekMatch, error: weekError } = await supabase
    .from("testimonials")
    .select("id, quote, author_name, context_line, featured_week, is_active")
    .eq("is_active", true)
    .eq("featured_week", currentWeekStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (weekError) {
    return null;
  }

  if (weekMatch) {
    return mapRow(weekMatch as TestimonialRow);
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("testimonials")
    .select("id, quote, author_name, context_line, featured_week, is_active")
    .eq("is_active", true)
    .order("featured_week", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError || !fallback) {
    return null;
  }

  return mapRow(fallback as TestimonialRow);
}
