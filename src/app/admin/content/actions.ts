"use server";

import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { getDisplayName } from "@/lib/profile/display-name";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ensureStorageBuckets } from "@/lib/supabase/ensure-storage-buckets";
import type { StorageBucket } from "@/lib/supabase/upload";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBulkFlashcards } from "@/lib/admin/parse-bulk-flashcards";
import { revalidatePath } from "next/cache";

const ADMIN_PATH = "/admin/content";
const ADMIN_CURRICULUM_PATH = "/admin/content/curriculum";
const COMMUNITY_PATH = "/dashboard/community";
const COMMUNITY_EVENTS_PATH = "/dashboard/community/events";

export async function ensureStorageBucketsAction(): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    await ensureStorageBuckets(supabase);
    return {};
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Failed to prepare storage buckets. Check SUPABASE_SERVICE_ROLE_KEY.",
    };
  }
}

export type AdminUploadUrlResult = ActionResult & {
  signedUrl?: string;
  publicUrl?: string;
};

export async function createAdminStorageUploadUrl(
  bucket: StorageBucket,
  fileName: string
): Promise<AdminUploadUrlResult> {
  try {
    const supabase = await requireAdmin();
    await ensureStorageBuckets(supabase);

    const ext = fileName.split(".").pop() ?? "bin";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return { error: error?.message ?? "Failed to create upload URL." };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return { signedUrl: data.signedUrl, publicUrl };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to prepare upload.",
    };
  }
}

function parseDatetimeLocal(value: string | null): string | null {
  if (!value?.trim()) return null;
  return new Date(value).toISOString();
}

function parseEventForm(formData: FormData) {
  const requiredTier = (formData.get("required_tier") as string) || null;
  const recurrenceFreq = (formData.get("recurrence_freq") as string) || null;
  const recurrenceUntilRaw = formData.get("recurrence_until") as string;

  return {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    starts_at: parseDatetimeLocal(formData.get("starts_at") as string),
    ends_at: parseDatetimeLocal(formData.get("ends_at") as string),
    location: (formData.get("location") as string) || null,
    meeting_url: (formData.get("meeting_url") as string) || null,
    external_url: (formData.get("external_url") as string) || null,
    required_tier: requiredTier || null,
    is_free: formData.get("is_free") === "true",
    display_order: parseInt((formData.get("display_order") as string) || "0", 10),
    recurrence_freq:
      recurrenceFreq === "weekly" ||
      recurrenceFreq === "biweekly" ||
      recurrenceFreq === "monthly"
        ? recurrenceFreq
        : null,
    recurrence_until: recurrenceUntilRaw
      ? parseDatetimeLocal(`${recurrenceUntilRaw}T23:59`)
      : null,
  };
}

export async function requireAdminFromActions() {
  return requireAdmin();
}

async function requireAdmin() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user || !(await canAccessAdminPanel(user, authClient))) {
    throw new Error("Unauthorized");
  }

  return createServiceRoleClient();
}

export type ActionResult = { error?: string; success?: string };

function withDbHint(message: string): string {
  if (message.includes("pdf_url") && message.includes("schema cache")) {
    return `${message} Run supabase/lesson-pdfs.sql in the Supabase SQL Editor, then retry.`;
  }
  if (message.includes("presentation_url") && message.includes("schema cache")) {
    return `${message} Run supabase/lesson-presentations.sql in the Supabase SQL Editor, then retry.`;
  }
  if (
    (message.includes("generated_audio_status") || message.includes("audio_assets")) &&
    message.includes("schema cache")
  ) {
    return `${message} Run supabase/lesson-generated-audio.sql and supabase/audio-assets.sql in the Supabase SQL Editor, then retry.`;
  }
  if (message.includes("lesson_id") && message.includes("schema cache")) {
    return `${message} Run supabase/lesson-links.sql in the Supabase SQL Editor, then retry.`;
  }
  if (message.includes("row-level security")) {
    return `${message} Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API), or run supabase/admin-rls.sql and sign out/in.`;
  }
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return message;
  }
  if (message.includes("quiz_id") && message.includes("not-null")) {
    return `${message} Run: ALTER TABLE public.flashcards ALTER COLUMN quiz_id DROP NOT NULL; in the Supabase SQL Editor.`;
  }
  if (message.includes("permission denied")) {
    return `${message} Run supabase/grants.sql in the Supabase SQL Editor, then retry.`;
  }
  return message;
}

// ---- Lessons ----

export async function createLesson(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const courseId = formData.get("course_id") as string;
    const lessonNumber = parseInt(formData.get("lesson_number") as string, 10);
    const title = formData.get("title") as string;
    const isFree = formData.get("is_free") === "true";
    const audioUrl = (formData.get("audio_url") as string) || null;
    const pdfUrl = (formData.get("pdf_url") as string) || null;
    const presentationUrl = String(formData.get("presentation_url") ?? "").trim() || null;
    const audioScript = String(formData.get("audio_script") ?? "").trim() || null;

    if (!courseId || !title || Number.isNaN(lessonNumber)) {
      return { error: "Course, lesson number, and title are required." };
    }

    const { error } = await supabase.from("lessons").insert({
      course_id: courseId,
      lesson_number: lessonNumber,
      title,
      is_free: isFree,
      audio_url: audioUrl,
      pdf_url: pdfUrl,
      presentation_url: presentationUrl,
      audio_script: audioScript,
    });

    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Lesson created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create lesson." };
  }
}

export async function updateLesson(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = formData.get("id") as string;
    const courseId = formData.get("course_id") as string;
    const lessonNumber = parseInt(formData.get("lesson_number") as string, 10);
    const title = formData.get("title") as string;
    const isFree = formData.get("is_free") === "true";
    const audioUrl = formData.get("audio_url") as string | null;
    const pdfUrl = formData.get("pdf_url") as string | null;
    const presentationUrl = String(formData.get("presentation_url") ?? "").trim();
    const audioScript = String(formData.get("audio_script") ?? "").trim();

    const updates: Record<string, unknown> = {
      course_id: courseId,
      lesson_number: lessonNumber,
      title,
      is_free: isFree,
      presentation_url: presentationUrl || null,
      audio_script: audioScript || null,
    };

    if (audioUrl) {
      updates.audio_url = audioUrl;
    }

    if (pdfUrl) {
      updates.pdf_url = pdfUrl;
    }

    const { error } = await supabase.from("lessons").update(updates).eq("id", id);
    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Lesson updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update lesson." };
  }
}

export async function deleteLesson(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) return { error: withDbHint(error.message) };
    revalidatePath(ADMIN_PATH);
    return { success: "Lesson deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete lesson." };
  }
}

// ---- Quizzes ----

export async function createQuiz(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    let courseId = formData.get("course_id") as string;
    let levelNumber = parseInt(formData.get("level_number") as string, 10);
    const title = formData.get("title") as string;
    const lessonId = (formData.get("lesson_id") as string) || null;

    if (lessonId) {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("course_id, lesson_number")
        .eq("id", lessonId)
        .single();

      if (lesson) {
        courseId = lesson.course_id;
        levelNumber = lesson.lesson_number;
      }
    }

    if (!courseId || !title || Number.isNaN(levelNumber)) {
      return { error: "Course, level number, and title are required." };
    }

    const { error } = await supabase.from("quizzes").insert({
      course_id: courseId,
      level_number: levelNumber,
      title,
    });

    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Quiz created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create quiz." };
  }
}

export async function deleteQuiz(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) return { error: withDbHint(error.message) };
    revalidatePath(ADMIN_PATH);
    return { success: "Quiz deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete quiz." };
  }
}

export async function createQuizQuestion(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const quizId = formData.get("quiz_id") as string;
    const questionText = formData.get("question_text") as string;
    const optionA = formData.get("option_a") as string;
    const optionB = formData.get("option_b") as string;
    const optionC = formData.get("option_c") as string;
    const optionD = formData.get("option_d") as string;
    const correctAnswer = formData.get("correct_answer") as string;
    const questionOrder = parseInt(
      (formData.get("question_order") as string) || "0",
      10
    );

    if (!quizId || !questionText || !correctAnswer) {
      return { error: "Quiz, question text, and correct answer are required." };
    }

    const { error } = await supabase.from("quiz_questions").insert({
      quiz_id: quizId,
      question_text: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_answer: correctAnswer,
      question_order: questionOrder,
    });

    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Question added." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add question." };
  }
}

export async function deleteQuizQuestion(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
    if (error) return { error: withDbHint(error.message) };
    revalidatePath(ADMIN_PATH);
    return { success: "Question deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete question." };
  }
}

export async function updateQuizQuestion(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = formData.get("id") as string;
    const questionText = formData.get("question_text") as string;
    const optionA = formData.get("option_a") as string;
    const optionB = formData.get("option_b") as string;
    const optionC = formData.get("option_c") as string;
    const optionD = formData.get("option_d") as string;
    const correctAnswer = formData.get("correct_answer") as string;
    const questionOrder = parseInt(
      (formData.get("question_order") as string) || "0",
      10
    );

    if (!id || !questionText || !optionA || !optionB || !optionC || !optionD) {
      return { error: "All question fields are required." };
    }

    if (!["a", "b", "c", "d"].includes(correctAnswer)) {
      return { error: "Correct answer must be one of A, B, C, or D." };
    }

    const { error } = await supabase
      .from("quiz_questions")
      .update({
        question_text: questionText,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_answer: correctAnswer,
        question_order: questionOrder,
      })
      .eq("id", id);

    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Question updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update question." };
  }
}

export async function bulkCreateQuizQuestions(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const quizId = formData.get("quiz_id") as string;
    const bulkItemsRaw = formData.get("bulk_items") as string;

    if (!quizId || !bulkItemsRaw) {
      return { error: "Quiz and parsed questions are required." };
    }

    const parsed = JSON.parse(bulkItemsRaw) as Array<{
      question_text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_answer: "a" | "b" | "c" | "d";
      question_order: number;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { error: "No valid questions to import." };
    }

    const rows = parsed.map((item) => ({
      quiz_id: quizId,
      question_text: item.question_text,
      option_a: item.option_a,
      option_b: item.option_b,
      option_c: item.option_c,
      option_d: item.option_d,
      correct_answer: item.correct_answer,
      question_order: item.question_order,
    }));

    const { error } = await supabase.from("quiz_questions").insert(rows);
    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: `${rows.length} questions imported.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to import questions." };
  }
}

// ---- Flashcard sets & cards ----

const FLASHCARD_CATEGORIES = ["alphabet", "vocab", "sentences"] as const;

function parseTopicTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = parseInt(raw, 10);
  return Number.isNaN(value) ? null : value;
}

function parseCategory(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  return FLASHCARD_CATEGORIES.includes(raw as (typeof FLASHCARD_CATEGORIES)[number])
    ? (raw as (typeof FLASHCARD_CATEGORIES)[number])
    : null;
}

async function getFlashcardSetName(supabase: SupabaseClient, deckId: string) {
  const { data } = await supabase
    .from("flashcard_sets")
    .select("name")
    .eq("id", deckId)
    .single();

  return data?.name ?? "Deck";
}

async function syncSetCourseLinks(
  supabase: SupabaseClient,
  deckId: string,
  courseIds: string[],
  lessonIds: string[]
) {
  await supabase.from("set_course_links").delete().eq("deck_id", deckId);

  const rows: Array<{
    deck_id: string;
    course_id?: string;
    lesson_id?: string;
  }> = [];

  for (const courseId of courseIds) {
    rows.push({ deck_id: deckId, course_id: courseId });
  }

  for (const lessonId of lessonIds) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("course_id")
      .eq("id", lessonId)
      .single();

    rows.push({
      deck_id: deckId,
      lesson_id: lessonId,
      course_id: lesson?.course_id ?? undefined,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("set_course_links").insert(rows);
    if (error) throw error;
  }
}

function flashcardFields({
  deckId,
  deckName,
  frontText,
  backText,
  lessonId,
  quizId,
  category,
  difficulty,
  topicTags,
  iconName,
}: {
  deckId: string;
  deckName: string;
  frontText: string;
  backText: string;
  lessonId: string | null;
  quizId: string | null;
  category: string | null;
  difficulty: number | null;
  topicTags: string[];
  iconName: string | null;
}) {
  const row: Record<string, unknown> = {
    deck_id: deckId,
    deck_name: deckName,
    front_text: frontText,
    back_text: backText,
    category,
    difficulty,
    topic_tags: topicTags,
    icon_name: iconName,
  };
  if (lessonId) row.lesson_id = lessonId;
  if (quizId) row.quiz_id = quizId;
  return row;
}

async function resolveQuizIdForLesson(
  supabase: SupabaseClient,
  lessonId: string | null
): Promise<string | null> {
  if (!lessonId) return null;

  const { data: lesson } = await supabase
    .from("lessons")
    .select("course_id, lesson_number")
    .eq("id", lessonId)
    .single();

  if (!lesson) return null;

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id")
    .eq("course_id", lesson.course_id)
    .eq("level_number", lesson.lesson_number)
    .maybeSingle();

  return quiz?.id ?? null;
}

export async function createFlashcardSet(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;

    if (!name) return { error: "Set name is required." };

    const { error } = await supabase.from("flashcard_sets").insert({
      name,
      description,
    });

    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Flashcard set created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create flashcard set." };
  }
}

export async function updateFlashcardSet(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = formData.get("id") as string;
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const courseIds = formData.getAll("course_ids").map(String).filter(Boolean);
    const lessonIds = formData.getAll("lesson_ids").map(String).filter(Boolean);

    if (!id || !name) return { error: "Set id and name are required." };

    const { error } = await supabase
      .from("flashcard_sets")
      .update({ name, description })
      .eq("id", id);

    if (error) return { error: withDbHint(error.message) };

    await supabase
      .from("flashcards")
      .update({ deck_name: name })
      .eq("deck_id", id);

    await syncSetCourseLinks(supabase, id, courseIds, lessonIds);

    revalidatePath(ADMIN_PATH);
    return { success: "Flashcard set updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update flashcard set." };
  }
}

export async function deleteFlashcardSet(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("flashcard_sets").delete().eq("id", id);
    if (error) return { error: withDbHint(error.message) };
    revalidatePath(ADMIN_PATH);
    return { success: "Flashcard set deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete flashcard set." };
  }
}

export async function createFlashcard(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const deckId = formData.get("deck_id") as string;
    const frontText = formData.get("front_text") as string;
    const backText = formData.get("back_text") as string;
    const lessonId = (formData.get("lesson_id") as string) || null;

    if (!deckId || !frontText || !backText) {
      return { error: "Deck, front text, and back text are required." };
    }

    const deckName = await getFlashcardSetName(supabase, deckId);
    const quizId = await resolveQuizIdForLesson(supabase, lessonId);

    const { error } = await supabase.from("flashcards").insert(
      flashcardFields({
        deckId,
        deckName,
        frontText,
        backText,
        lessonId,
        quizId,
        category: parseCategory(formData.get("category")),
        difficulty: parseOptionalInt(formData.get("difficulty")),
        topicTags: parseTopicTags(formData.get("topic_tags")),
        iconName: (formData.get("icon_name") as string)?.trim() || null,
      })
    );

    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Flashcard created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create flashcard." };
  }
}

export async function deleteFlashcard(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) return { error: withDbHint(error.message) };
    revalidatePath(ADMIN_PATH);
    return { success: "Flashcard deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete flashcard." };
  }
}

export async function updateFlashcard(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = formData.get("id") as string;
    const deckId = formData.get("deck_id") as string;
    const frontText = formData.get("front_text") as string;
    const backText = formData.get("back_text") as string;
    const lessonId = (formData.get("lesson_id") as string) || null;

    if (!id || !deckId || !frontText || !backText) {
      return { error: "Deck, front text, and back text are required." };
    }

    const deckName = await getFlashcardSetName(supabase, deckId);
    const quizId = await resolveQuizIdForLesson(supabase, lessonId);

    const { error } = await supabase
      .from("flashcards")
      .update(
        flashcardFields({
          deckId,
          deckName,
          frontText,
          backText,
          lessonId,
          quizId,
          category: parseCategory(formData.get("category")),
          difficulty: parseOptionalInt(formData.get("difficulty")),
          topicTags: parseTopicTags(formData.get("topic_tags")),
          iconName: (formData.get("icon_name") as string)?.trim() || null,
        })
      )
      .eq("id", id);

    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Flashcard updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update flashcard." };
  }
}

export async function bulkCreateFlashcards(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const deckId = formData.get("deck_id") as string;
    const bulkText = (formData.get("bulk_text") as string)?.trim();
    const bulkItemsRaw = formData.get("bulk_items") as string | null;
    const lessonId = (formData.get("lesson_id") as string) || null;

    if (!deckId) {
      return { error: "Deck is required." };
    }

    let parsed: Array<{ front_text: string; back_text: string }> = [];

    if (bulkText) {
      const result = parseBulkFlashcards(bulkText);
      parsed = result.items;
      if (parsed.length === 0) {
        return {
          error:
            result.errors[0] ??
            "No valid flashcards to import. Use tab-separated rows (front[TAB]back).",
        };
      }
    } else if (bulkItemsRaw) {
      try {
        const legacy = JSON.parse(bulkItemsRaw) as Array<{
          front_text: string;
          back_text: string;
        }>;
        if (Array.isArray(legacy)) parsed = legacy;
      } catch {
        return { error: "Could not read bulk flashcard data. Paste rows and try again." };
      }
    }

    if (parsed.length === 0) {
      return { error: "No valid flashcards to import." };
    }

    const deckName = await getFlashcardSetName(supabase, deckId);
    const quizId = await resolveQuizIdForLesson(supabase, lessonId);
    const category = parseCategory(formData.get("category"));
    const difficulty = parseOptionalInt(formData.get("difficulty"));
    const topicTags = parseTopicTags(formData.get("topic_tags"));
    const iconName = (formData.get("icon_name") as string)?.trim() || null;

    const rows = parsed.map((item) =>
      flashcardFields({
        deckId,
        deckName,
        frontText: item.front_text,
        backText: item.back_text,
        lessonId,
        quizId,
        category,
        difficulty,
        topicTags,
        iconName,
      })
    );

    const { error } = await supabase.from("flashcards").insert(rows);
    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    revalidatePath(ADMIN_CURRICULUM_PATH);
    return { success: `${rows.length} flashcards imported.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to import flashcards." };
  }
}

// ---- Events ----

export async function createEvent(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const event = parseEventForm(formData);

    if (!event.title || !event.starts_at) {
      return { error: "Title and start time are required." };
    }

    const { error } = await supabase.from("events").insert(event);
    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    revalidatePath(COMMUNITY_PATH);
    revalidatePath(COMMUNITY_EVENTS_PATH);
    return { success: "Event created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create event." };
  }
}

export async function updateEvent(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = formData.get("id") as string;
    const event = parseEventForm(formData);

    if (!id || !event.title || !event.starts_at) {
      return { error: "Title and start time are required." };
    }

    const { error } = await supabase.from("events").update(event).eq("id", id);
    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    revalidatePath(COMMUNITY_PATH);
    revalidatePath(COMMUNITY_EVENTS_PATH);
    return { success: "Event updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update event." };
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return { error: withDbHint(error.message) };
    revalidatePath(ADMIN_PATH);
    revalidatePath(COMMUNITY_PATH);
    revalidatePath(COMMUNITY_EVENTS_PATH);
    return { success: "Event deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete event." };
  }
}

// ---- Streak debug (admin testing) ----

export type StreakDebugState = {
  user_id: string;
  email: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  redemption_available: boolean;
  streak_broken_date: string | null;
  streak_before_break: number | null;
  redeemed_today: boolean;
};

type StreakDebugResult = ActionResult & { data?: StreakDebugState };

async function findUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ userId?: string; error?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: "Email is required." };

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { error: error.message };

  const user = data.users.find(
    (item) => item.email?.toLowerCase() === normalized
  );

  if (!user) return { error: "No user found with that email." };
  return { userId: user.id };
}

const STREAK_DEBUG_SELECT =
  "current_streak, longest_streak, last_activity_date, redemption_available, streak_broken_date, streak_before_break, redeemed_today";

const STREAK_DEBUG_SELECT_BASE =
  "current_streak, longest_streak, last_activity_date";

async function fetchStreakDebugRow(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Record<string, unknown> | null; error?: string }> {
  const extended = await supabase
    .from("user_streaks")
    .select(STREAK_DEBUG_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (!extended.error) {
    return { data: extended.data };
  }

  if (!extended.error.message.includes("does not exist")) {
    return { data: null, error: withDbHint(extended.error.message) };
  }

  const base = await supabase
    .from("user_streaks")
    .select(STREAK_DEBUG_SELECT_BASE)
    .eq("user_id", userId)
    .maybeSingle();

  if (base.error) return { data: null, error: withDbHint(base.error.message) };
  return { data: base.data };
}

function mapStreakDebugRow(
  userId: string,
  email: string,
  row: Record<string, unknown> | null
): StreakDebugState {
  return {
    user_id: userId,
    email,
    current_streak: Number(row?.current_streak ?? 0),
    longest_streak: Number(row?.longest_streak ?? 0),
    last_activity_date: (row?.last_activity_date as string | null) ?? null,
    redemption_available: Boolean(row?.redemption_available),
    streak_broken_date: (row?.streak_broken_date as string | null) ?? null,
    streak_before_break:
      row?.streak_before_break == null ? null : Number(row.streak_before_break),
    redeemed_today: Boolean(row?.redeemed_today),
  };
}

export async function debugGetUserStreak(email: string): Promise<StreakDebugResult> {
  try {
    const supabase = await requireAdmin();
    const lookup = await findUserIdByEmail(supabase, email);
    if (lookup.error || !lookup.userId) return { error: lookup.error };

    const fetched = await fetchStreakDebugRow(supabase, lookup.userId);
    if (fetched.error) return { error: fetched.error };

    return {
      success: fetched.data ? "Loaded streak state." : "No streak row yet — save to create one.",
      data: mapStreakDebugRow(lookup.userId, email.trim(), fetched.data),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load streak." };
  }
}

export async function debugSetUserStreakDate(input: {
  email: string;
  lastActivityDate: string;
  currentStreak?: number;
  longestStreak?: number;
}): Promise<StreakDebugResult> {
  try {
    const supabase = await requireAdmin();
    const lookup = await findUserIdByEmail(supabase, input.email);
    if (lookup.error || !lookup.userId) return { error: lookup.error };

    if (!input.lastActivityDate?.trim()) {
      return { error: "last_activity_date is required." };
    }

    const existing = await fetchStreakDebugRow(supabase, lookup.userId);
    if (existing.error) return { error: existing.error };

    const current =
      input.currentStreak != null && !Number.isNaN(input.currentStreak)
        ? input.currentStreak
        : Number(existing.data?.current_streak ?? 0);
    const longest = Math.max(
      input.longestStreak != null && !Number.isNaN(input.longestStreak)
        ? input.longestStreak
        : Number(existing.data?.longest_streak ?? 0),
      current
    );

    if (current <= 0) {
      return {
        error:
          "current_streak must be greater than 0 for streak testing. Set current_streak before saving.",
      };
    }

    const fullUpdate = {
      last_activity_date: input.lastActivityDate,
      current_streak: current,
      longest_streak: longest,
      redemption_available: false,
      streak_broken_date: null,
      streak_before_break: null,
      redeemed_today: false,
    };

    const basePayload = {
      user_id: lookup.userId,
      last_activity_date: input.lastActivityDate,
      current_streak: current,
      longest_streak: longest,
    };

    const baseUpdate = {
      last_activity_date: input.lastActivityDate,
      current_streak: current,
      longest_streak: longest,
    };

    let saved: Record<string, unknown> | null = null;
    let saveError: string | null = null;

    if (existing.data) {
      const extended = await supabase
        .from("user_streaks")
        .update(fullUpdate)
        .eq("user_id", lookup.userId)
        .select(STREAK_DEBUG_SELECT)
        .single();

      if (!extended.error) {
        saved = extended.data;
      } else if (extended.error.message.includes("does not exist")) {
        const base = await supabase
          .from("user_streaks")
          .update(baseUpdate)
          .eq("user_id", lookup.userId)
          .select(STREAK_DEBUG_SELECT_BASE)
          .single();
        if (base.error) saveError = withDbHint(base.error.message);
        else saved = base.data;
      } else {
        saveError = withDbHint(extended.error.message);
      }
    } else {
      const extended = await supabase
        .from("user_streaks")
        .insert({ ...fullUpdate, user_id: lookup.userId })
        .select(STREAK_DEBUG_SELECT)
        .single();

      if (!extended.error) {
        saved = extended.data;
      } else if (extended.error.message.includes("does not exist")) {
        const base = await supabase
          .from("user_streaks")
          .insert(basePayload)
          .select(STREAK_DEBUG_SELECT_BASE)
          .single();
        if (base.error) saveError = withDbHint(base.error.message);
        else saved = base.data;
      } else {
        saveError = withDbHint(extended.error.message);
      }
    }

    if (saveError || !saved) {
      return { error: saveError ?? "Failed to save streak state." };
    }

    return {
      success: `Saved: current ${current}, longest ${longest}, last activity ${input.lastActivityDate}. Open Home to run streak evaluation (3+ day gap resets current to 0).`,
      data: mapStreakDebugRow(lookup.userId, input.email.trim(), saved),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update streak." };
  }
}

export type AdminMemberOption = {
  userId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  appRoles?: string[];
};

async function attachProfileRoles(
  supabase: SupabaseClient,
  members: Map<string, AdminMemberOption>
) {
  const ids = [...members.keys()];
  if (ids.length === 0) return;

  const { data: roleRows } = await supabase
    .from("profile_roles")
    .select("user_id, role")
    .in("user_id", ids);

  const rolesByUser = new Map<string, string[]>();
  for (const row of roleRows ?? []) {
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.role);
    rolesByUser.set(row.user_id, list);
  }

  for (const [userId, member] of members) {
    member.appRoles = rolesByUser.get(userId) ?? [];
  }
}

export async function searchAdminMembers(
  query: string
): Promise<{ results?: AdminMemberOption[]; error?: string }> {
  try {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { results: [] };

    const supabase = await requireAdmin();
    const sanitized = q.replace(/[%_]/g, "");
    if (!sanitized) return { results: [] };

    const byId = new Map<string, AdminMemberOption>();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_name, avatar_url")
      .or(`full_name.ilike.%${sanitized}%,preferred_name.ilike.%${sanitized}%`)
      .limit(25);

    if (profilesError) return { error: profilesError.message };

    for (const profile of profiles ?? []) {
      byId.set(profile.id, {
        userId: profile.id,
        email: null,
        displayName: getDisplayName(profile) ?? "Member",
        avatarUrl: profile.avatar_url,
        appRoles: [],
      });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) return { error: authError.message };

    const emailMatches = authData.users
      .filter((user) => user.email?.toLowerCase().includes(sanitized))
      .slice(0, 25);

    const emailOnlyIds = emailMatches
      .map((user) => user.id)
      .filter((id) => !byId.has(id));

    if (emailOnlyIds.length > 0) {
      const { data: extraProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, preferred_name, avatar_url")
        .in("id", emailOnlyIds);

      for (const user of emailMatches) {
        const profile = extraProfiles?.find((row) => row.id === user.id);
        byId.set(user.id, {
          userId: user.id,
          email: user.email ?? null,
          displayName: getDisplayName(profile ?? null) ?? user.email ?? "Member",
          avatarUrl: profile?.avatar_url ?? null,
          appRoles: [],
        });
      }
    }

    for (const user of authData.users) {
      const existing = byId.get(user.id);
      if (existing && user.email) {
        existing.email = user.email;
      }
    }

    await attachProfileRoles(supabase, byId);

    return { results: [...byId.values()].slice(0, 25) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Search failed." };
  }
}
