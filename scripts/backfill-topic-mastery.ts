/**
 * Backfill topic_mastery from lesson_progress fallback encoding
 * (last_page_viewed as units 0–15) for Everyday Punjabi / Community lessons.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-topic-mastery.ts
 *   npx tsx --env-file=.env.local scripts/backfill-topic-mastery.ts --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { COMMUNITY_COURSE_ID } from "../src/lib/topics/constants";

const STAGE_DEPTH_MAX = 5;

function decodeMasteryUnits(units: number): { stage: number; depth: number } {
  const clamped = Math.max(0, Math.min(STAGE_DEPTH_MAX * 3, Math.round(units)));
  if (clamped >= STAGE_DEPTH_MAX * 3) {
    return { stage: 3, depth: STAGE_DEPTH_MAX };
  }
  const stage = Math.floor(clamped / STAGE_DEPTH_MAX) + 1;
  const depth = clamped % STAGE_DEPTH_MAX;
  return { stage, depth };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", COMMUNITY_COURSE_ID);

  if (lessonsError) throw lessonsError;
  const lessonIds = (lessons ?? []).map((row) => row.id as string);
  if (lessonIds.length === 0) {
    console.log("No Community lessons found — nothing to backfill.");
    return;
  }

  console.log(`Community lessons: ${lessonIds.length}`);

  const { data: progressRows, error: progressError } = await supabase
    .from("lesson_progress")
    .select(
      "user_id, lesson_id, completed, last_position, last_page_viewed, total_pages, pdf_completed"
    )
    .in("lesson_id", lessonIds);

  if (progressError) throw progressError;

  let candidates = 0;
  let skippedPdf = 0;
  let skippedEmpty = 0;
  let upserted = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const row of progressRows ?? []) {
    const pageViewed =
      row.last_page_viewed == null ? null : Number(row.last_page_viewed);
    const totalPages = row.total_pages == null ? null : Number(row.total_pages);

    // Real PDF progress: page numbers above the mastery unit range.
    if (pageViewed != null && pageViewed > 15) {
      skippedPdf += 1;
      continue;
    }

    let units = 0;
    if (pageViewed != null && pageViewed > 0) {
      units = Math.min(15, Math.max(0, pageViewed));
    } else if (
      row.last_position != null &&
      Number(row.last_position) > 0 &&
      Number(row.last_position) <= 5
    ) {
      units = Number(row.last_position);
    } else if (row.completed) {
      units = 1;
    }

    if (units <= 0) {
      skippedEmpty += 1;
      continue;
    }

    candidates += 1;
    const { stage, depth } = decodeMasteryUnits(units);
    const progressPercent =
      totalPages != null && totalPages >= 0 && totalPages <= 100
        ? clampPercent(totalPages)
        : isFullyMastered(stage, depth)
          ? 100
          : 0;

    const payload = {
      user_id: row.user_id,
      lesson_id: row.lesson_id,
      mastery_level: units,
      progress_percent: progressPercent,
      stage,
      depth,
    };

    if (samples.length < 8) {
      samples.push({
        user: String(row.user_id).slice(0, 8),
        lesson: String(row.lesson_id).slice(0, 8),
        units,
        stage,
        depth,
        progressPercent,
        last_page_viewed: pageViewed,
        total_pages: totalPages,
      });
    }

    if (dryRun) continue;

    const { error } = await supabase
      .from("topic_mastery")
      .upsert(payload, { onConflict: "user_id,lesson_id" });
    if (error) throw error;
    upserted += 1;
  }

  console.log(dryRun ? "Dry run complete." : "Backfill complete.");
  console.log({
    progressRows: progressRows?.length ?? 0,
    candidates,
    upserted: dryRun ? 0 : upserted,
    skippedPdf,
    skippedEmpty,
  });
  console.log("Sample rows:", samples);
}

function isFullyMastered(stage: number, depth: number): boolean {
  return stage >= 3 && depth >= STAGE_DEPTH_MAX;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
