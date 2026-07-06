/**
 * One-time backfill: sync set_course_links from course_association + week_number.
 * Run: npx tsx scripts/backfill-flashcard-set-links.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildCourseLessonLookup,
  inferWeekNumberFromSetName,
  resolveFlashcardSetLinks,
} from "../src/lib/admin/resolve-flashcard-set-links";
import type { FlashcardSetCourseAssociation } from "../src/app/admin/content/types";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const [{ data: courses }, { data: lessons }, { data: sets }] = await Promise.all([
    supabase.from("courses").select("id, name, required_tier"),
    supabase.from("lessons").select("id, course_id, lesson_number, title"),
    supabase.from("flashcard_sets").select("id, name, course_association, week_number"),
  ]);

  if (!sets?.length) {
    console.log("No flashcard sets found.");
    return;
  }

  const lookup = buildCourseLessonLookup(courses ?? [], lessons ?? []);

  await supabase.from("set_course_links").delete().neq("deck_id", "00000000-0000-0000-0000-000000000000");

  let linked = 0;
  let courseOnly = 0;
  let skipped = 0;

  for (const set of sets) {
    const association = (set.course_association ?? "uncategorized") as FlashcardSetCourseAssociation;
    if (association === "uncategorized") {
      skipped += 1;
      continue;
    }

    const effectiveWeek =
      set.week_number ?? inferWeekNumberFromSetName(set.name, association);

    if (effectiveWeek !== set.week_number && effectiveWeek !== null) {
      await supabase
        .from("flashcard_sets")
        .update({ week_number: effectiveWeek })
        .eq("id", set.id);
    }

    const { courseIds, lessonIds } = resolveFlashcardSetLinks(
      lookup,
      association,
      effectiveWeek,
      set.name
    );

    if (courseIds.length === 0) {
      skipped += 1;
      continue;
    }

    const rows: Array<{
      deck_id: string;
      course_id: string;
      lesson_id: string | null;
    }> = [];

    for (const courseId of courseIds) {
      rows.push({ deck_id: set.id, course_id: courseId, lesson_id: null });
    }
    for (const lessonId of lessonIds) {
      rows.push({
        deck_id: set.id,
        course_id: courseIds[0],
        lesson_id: lessonId,
      });
    }

    const { error } = await supabase.from("set_course_links").insert(rows);
    if (error) {
      console.error("Failed", set.name, error.message);
      continue;
    }

    if (lessonIds.length > 0) linked += 1;
    else courseOnly += 1;
  }

  console.log(`Done. Lesson-linked: ${linked}, course-only: ${courseOnly}, skipped: ${skipped}`);
}

main();
