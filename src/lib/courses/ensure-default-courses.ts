import type { PaidCourseTier } from "@/lib/membership/access";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_COURSES: {
  name: string;
  required_tier: PaidCourseTier;
  display_order: number;
  description: string;
}[] = [
  {
    name: "Foundational Course",
    required_tier: "foundational",
    display_order: 1,
    description: "Pronunciation, core vocabulary, and everyday phrases.",
  },
  {
    name: "Beginners Course",
    required_tier: "beginners",
    display_order: 2,
    description: "Build confidence with guided lessons for early learners.",
  },
  {
    name: "Kidda Community",
    required_tier: "community",
    display_order: 3,
    description: "Live sessions, advanced content, and the full Kidda community.",
  },
];

function courseMatchesTier(
  course: { name: string; required_tier?: string | null },
  tier: PaidCourseTier
) {
  if (course.required_tier === tier) return true;

  const name = course.name.toLowerCase();
  if (tier === "foundational" && name.includes("foundational")) return true;
  if (tier === "beginners" && name.includes("beginner") && !name.includes("kids")) return true;
  if (tier === "community" && name.includes("community")) return true;

  return false;
}

export async function ensureDefaultCourses(supabase: SupabaseClient) {
  const { data: existing } = await supabase
    .from("courses")
    .select("id, name, required_tier");

  const rows = [...(existing ?? [])];

  for (const course of DEFAULT_COURSES) {
    if (rows.some((row) => courseMatchesTier(row, course.required_tier))) {
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("courses")
      .insert({
        name: course.name,
        required_tier: course.required_tier,
        display_order: course.display_order,
        description: course.description,
      })
      .select("id, name, required_tier")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") continue;
      console.error(`ensureDefaultCourses: ${course.required_tier}`, error.message);
      continue;
    }

    if (inserted) {
      rows.push(inserted);
    }
  }
}
