/**
 * Idempotent seed: Kids Beginners Course (ages 10–12).
 *
 * Creates the course, 12 empty lesson shells (slides/recordings/flashcards come later),
 * the group package, and points existing "Kids Circle" cohorts at this course.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-kids-beginners-course.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  KIDS_BEGINNERS_COURSE_NAME,
  KIDS_BEGINNERS_LESSON_TITLES,
  KIDS_BEGINNERS_PACKAGE_SLUG,
} from "../src/lib/learning/kids-beginners";

const COURSE_DESCRIPTION =
  "12-week live Punjabi beginners course for children aged 10–12. Same weekly lesson structure as the adult Beginners course, with kid-specific slides, recordings, and practice.";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingCourse, error: existingError } = await supabase
    .from("courses")
    .select("id, name")
    .eq("name", KIDS_BEGINNERS_COURSE_NAME)
    .maybeSingle();
  if (existingError) throw existingError;

  let courseId = existingCourse?.id as string | undefined;
  if (!courseId) {
    const { data: inserted, error } = await supabase
      .from("courses")
      .insert({
        name: KIDS_BEGINNERS_COURSE_NAME,
        description: COURSE_DESCRIPTION,
        required_tier: "private", // unique index only allows one 'beginners' course
        content_track: "kids",
        is_public: false,
        display_order: 4,
        is_home_course: false,
      })
      .select("id")
      .single();
    if (error) throw error;
    courseId = inserted.id as string;
    console.log("Created course", courseId);
  } else {
    const { error } = await supabase
      .from("courses")
      .update({
        description: COURSE_DESCRIPTION,
        required_tier: "private", // unique index only allows one 'beginners' course
        content_track: "kids",
        is_public: false,
        display_order: 4,
      })
      .eq("id", courseId);
    if (error) throw error;
    console.log("Updated course", courseId);
  }

  const { data: existingLessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, lesson_number, title")
    .eq("course_id", courseId);
  if (lessonsError) throw lessonsError;

  const existingByNumber = new Map(
    (existingLessons ?? []).map((row) => [Number(row.lesson_number), row])
  );
  const missingLessons = KIDS_BEGINNERS_LESSON_TITLES.flatMap((title, index) => {
    const lessonNumber = index + 1;
    if (existingByNumber.has(lessonNumber)) return [];
    return [
      {
        course_id: courseId,
        lesson_number: lessonNumber,
        title,
        is_free: false,
        pdf_url: null,
        presentation_url: null,
        audio_url: null,
      },
    ];
  });

  if (missingLessons.length > 0) {
    const { error } = await supabase.from("lessons").insert(missingLessons);
    if (error) throw error;
    console.log(`Inserted ${missingLessons.length} lesson shells`);
  } else {
    console.log("Lesson shells already present");
  }

  for (const [index, title] of KIDS_BEGINNERS_LESSON_TITLES.entries()) {
    const lessonNumber = index + 1;
    const existing = existingByNumber.get(lessonNumber);
    if (!existing || existing.title === title) continue;
    const { error } = await supabase
      .from("lessons")
      .update({ title })
      .eq("id", existing.id);
    if (error) throw error;
  }

  const { error: packageError } = await supabase.from("packages").upsert(
    {
      slug: KIDS_BEGINNERS_PACKAGE_SLUG,
      name: "Kids Beginners Course (Group)",
      description:
        "Small-group Punjabi beginners lessons for ages 10–12, on a fixed weekly schedule.",
      course_id: courseId,
      delivery_mode: "group",
      includes_live_sessions: true,
      display_order: 5,
      active: true,
    },
    { onConflict: "slug" }
  );
  if (packageError) throw packageError;
  console.log("Upserted package", KIDS_BEGINNERS_PACKAGE_SLUG);

  const { data: kidsCohorts, error: cohortLoadError } = await supabase
    .from("cohorts")
    .select("id, name, course_id")
    .ilike("name", "%Kids Circle%");
  if (cohortLoadError) throw cohortLoadError;

  const toMove = (kidsCohorts ?? []).filter((row) => row.course_id !== courseId);
  if (toMove.length > 0) {
    const { error } = await supabase
      .from("cohorts")
      .update({ course_id: courseId })
      .in(
        "id",
        toMove.map((row) => row.id)
      );
    if (error) throw error;
    console.log(
      "Moved cohorts onto kids course:",
      toMove.map((row) => row.name).join(", ")
    );
  } else {
    console.log("Kids Circle cohorts already on this course (or none found)");
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
