/**
 * Retry Notion sync for feedback submissions that failed (e.g. after fixing integration access).
 *
 * Usage:
 *   npm run retry-notion-feedback -- --dry-run
 *   npm run retry-notion-feedback
 *   npm run retry-notion-feedback -- --patch-tutors
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildNotionFeedbackProperties,
  createNotionFeedbackPage,
  updateNotionFeedbackTutor,
} from "../src/lib/feedback/notion";
import { matchTutorName } from "../src/lib/feedback/load-feedback-context";
import type { FeedbackContext, FeedbackSubmitPayload } from "../src/lib/feedback/types";
import type { NotionCourseOption } from "../src/lib/feedback/constants";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const dryRun = process.argv.includes("--dry-run");
const patchTutors = process.argv.includes("--patch-tutors");

type FeedbackRow = {
  id: string;
  lesson_id: string | null;
  session_id: string | null;
  form_variant: "standard" | "week12" | "community";
  full_name: string;
  email: string;
  phone: string | null;
  cohort: string | null;
  course: string;
  lesson_label: string;
  tutor: string | null;
  tutor_unmatched: boolean;
  learning_relevance: number;
  tutor_effectiveness: number;
  confidence: number;
  understanding: number | null;
  speaking: number | null;
  understanding_grammar: number | null;
  clarity_structure: number | null;
  concept_breakdown: number | null;
  supportiveness: number | null;
  overall_score: number | null;
  comments: string;
  testimonials: string | null;
  recommend: "Yes" | "No" | null;
  video_testimonial: "Yes" | "No" | null;
  future_support: string[];
  submitted_at: string;
  notion_page_id: string | null;
};

function rowToContext(row: FeedbackRow): FeedbackContext {
  const lessonMatch = row.lesson_label.match(/Lesson\s+(\d+)/i);
  const { notionTutor, tutorUnmatched } = matchTutorName(row.tutor);
  return {
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    cohort: row.cohort ?? "N/A",
    course: row.course as NotionCourseOption,
    lessonLabel: row.lesson_label,
    lessonNumber: lessonMatch ? Number.parseInt(lessonMatch[1], 10) : null,
    tutor: row.tutor,
    notionTutor,
    tutorUnmatched,
    lessonId: row.lesson_id,
    sessionId: row.session_id ?? null,
    formVariant: row.form_variant,
  };
}

function rowToPayload(row: FeedbackRow): FeedbackSubmitPayload {
  return {
    formVariant: row.form_variant,
    lessonId: row.lesson_id,
    sessionId: row.session_id,
    learningRelevance: row.learning_relevance,
    tutorEffectiveness: row.tutor_effectiveness,
    confidence: row.confidence,
    understanding: row.understanding ?? undefined,
    speaking: row.speaking ?? undefined,
    understandingGrammar: row.understanding_grammar ?? undefined,
    clarityStructure: row.clarity_structure ?? undefined,
    conceptBreakdown: row.concept_breakdown ?? undefined,
    supportiveness: row.supportiveness ?? undefined,
    overallScore: row.overall_score ?? undefined,
    comments: row.comments,
    testimonials: row.testimonials,
    recommend: row.recommend ?? undefined,
    videoTestimonial: row.video_testimonial ?? undefined,
    futureSupport: row.future_support as FeedbackSubmitPayload["futureSupport"],
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, serviceKey);

  if (patchTutors) {
    const { data: rows, error } = await supabase
      .from("feedback_submissions")
      .select("*")
      .eq("notion_sync_status", "synced")
      .eq("tutor_unmatched", true)
      .not("notion_page_id", "is", null)
      .order("submitted_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!rows?.length) {
      console.log("No synced submissions need tutor patching.");
      return;
    }

    console.log(
      `Patching tutor on ${rows.length} Notion page(s)${dryRun ? " (dry run)" : ""}.`
    );

    for (const row of rows as FeedbackRow[]) {
      const { notionTutor } = matchTutorName(row.tutor);
      console.log(`\n• ${row.id} — ${row.tutor ?? "no tutor"} → ${notionTutor ?? "unmatched"}`);
      if (!notionTutor || !row.notion_page_id) continue;
      if (dryRun) continue;

      try {
        await updateNotionFeedbackTutor(row.notion_page_id, notionTutor);
        await supabase
          .from("feedback_submissions")
          .update({ tutor_unmatched: false })
          .eq("id", row.id);
        console.log(`  Patched Notion page ${row.notion_page_id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Notion patch failed.";
        console.error(`  Failed: ${message}`);
      }
    }

    return;
  }

  const { data: rows, error } = await supabase
    .from("feedback_submissions")
    .select("*")
    .neq("notion_sync_status", "synced")
    .order("submitted_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!rows?.length) {
    console.log("No unsynced feedback submissions found.");
    return;
  }

  console.log(`Found ${rows.length} submission(s) to sync${dryRun ? " (dry run)" : ""}.`);

  for (const row of rows as FeedbackRow[]) {
    const context = rowToContext(row);
    const payload = rowToPayload(row);
    const submittedAt = new Date(row.submitted_at);

    console.log(`\n• ${row.id} — ${row.full_name}, ${row.course}, ${row.lesson_label}`);

    if (dryRun) continue;

    try {
      const properties = buildNotionFeedbackProperties(context, payload, submittedAt);
      const { pageId } = await createNotionFeedbackPage(properties);

      await supabase
        .from("feedback_submissions")
        .update({
          notion_page_id: pageId,
          notion_sync_status: "synced",
          notion_synced_at: new Date().toISOString(),
          notion_sync_error: null,
        })
        .eq("id", row.id);

      console.log(`  Synced → Notion page ${pageId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Notion sync failed.";
      await supabase
        .from("feedback_submissions")
        .update({
          notion_sync_status: "failed",
          notion_sync_error: message,
        })
        .eq("id", row.id);

      console.error(`  Failed: ${message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
