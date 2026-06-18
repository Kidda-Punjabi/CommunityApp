"use server";

import { isAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const ADMIN_PATH = "/admin/content";
const EVENTS_PATH = "/dashboard/events";

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

async function requireAdmin() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user || !isAdmin(user)) {
    throw new Error("Unauthorized");
  }

  return createServiceRoleClient();
}

export type ActionResult = { error?: string; success?: string };

function withDbHint(message: string): string {
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

    if (!courseId || !title || Number.isNaN(lessonNumber)) {
      return { error: "Course, lesson number, and title are required." };
    }

    const { error } = await supabase.from("lessons").insert({
      course_id: courseId,
      lesson_number: lessonNumber,
      title,
      is_free: isFree,
      audio_url: audioUrl,
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

    const updates: Record<string, unknown> = {
      course_id: courseId,
      lesson_number: lessonNumber,
      title,
      is_free: isFree,
    };

    if (audioUrl) {
      updates.audio_url = audioUrl;
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

function flashcardFields(
  deckName: string,
  frontText: string,
  backText: string,
  lessonId: string | null,
  quizId: string | null
) {
  const row: Record<string, unknown> = {
    deck_name: deckName,
    front_text: frontText,
    back_text: backText,
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

export async function createFlashcard(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const deckName = formData.get("deck_name") as string;
    const frontText = formData.get("front_text") as string;
    const backText = formData.get("back_text") as string;
    const lessonId = (formData.get("lesson_id") as string) || null;

    if (!deckName || !frontText || !backText) {
      return { error: "All fields are required." };
    }

    const quizId = await resolveQuizIdForLesson(supabase, lessonId);

    const { error } = await supabase
      .from("flashcards")
      .insert(flashcardFields(deckName, frontText, backText, lessonId, quizId));

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
    const deckName = formData.get("deck_name") as string;
    const frontText = formData.get("front_text") as string;
    const backText = formData.get("back_text") as string;
    const lessonId = (formData.get("lesson_id") as string) || null;

    if (!id || !deckName || !frontText || !backText) {
      return { error: "Deck, front text, and back text are required." };
    }

    const quizId = await resolveQuizIdForLesson(supabase, lessonId);

    const { error } = await supabase
      .from("flashcards")
      .update(flashcardFields(deckName, frontText, backText, lessonId, quizId))
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
    const deckName = formData.get("deck_name") as string;
    const bulkItemsRaw = formData.get("bulk_items") as string;
    const lessonId = (formData.get("lesson_id") as string) || null;

    if (!deckName || !bulkItemsRaw) {
      return { error: "Deck and parsed flashcards are required." };
    }

    const parsed = JSON.parse(bulkItemsRaw) as Array<{
      front_text: string;
      back_text: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { error: "No valid flashcards to import." };
    }

    const quizId = await resolveQuizIdForLesson(supabase, lessonId);

    const rows = parsed.map((item) =>
      flashcardFields(deckName, item.front_text, item.back_text, lessonId, quizId)
    );

    const { error } = await supabase.from("flashcards").insert(rows);
    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: `${rows.length} flashcards imported.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to import flashcards." };
  }
}

// ---- Teachers ----

export async function createTeacher(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const name = formData.get("name") as string;
    const bio = (formData.get("bio") as string) || null;
    const specialty = (formData.get("specialty") as string) || null;
    const contactLink = (formData.get("contact_link") as string) || null;
    const displayOrder = parseInt(
      (formData.get("display_order") as string) || "0",
      10
    );
    const photoUrl = (formData.get("photo_url") as string) || null;

    if (!name) return { error: "Name is required." };

    const { error } = await supabase.from("teachers").insert({
      name,
      bio,
      specialty,
      contact_link: contactLink,
      photo_url: photoUrl,
      display_order: displayOrder,
    });

    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Teacher created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create teacher." };
  }
}

export async function updateTeacher(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const bio = (formData.get("bio") as string) || null;
    const specialty = (formData.get("specialty") as string) || null;
    const contactLink = (formData.get("contact_link") as string) || null;
    const displayOrder = parseInt(
      (formData.get("display_order") as string) || "0",
      10
    );
    const photoUrl = formData.get("photo_url") as string | null;

    const updates: Record<string, unknown> = {
      name,
      bio,
      specialty,
      contact_link: contactLink,
      display_order: displayOrder,
    };

    if (photoUrl) {
      updates.photo_url = photoUrl;
    }

    const { error } = await supabase.from("teachers").update(updates).eq("id", id);
    if (error) return { error: withDbHint(error.message) };

    revalidatePath(ADMIN_PATH);
    return { success: "Teacher updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update teacher." };
  }
}

export async function deleteTeacher(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) return { error: withDbHint(error.message) };
    revalidatePath(ADMIN_PATH);
    return { success: "Teacher deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete teacher." };
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
    revalidatePath(EVENTS_PATH);
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
    revalidatePath(EVENTS_PATH);
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
    revalidatePath(EVENTS_PATH);
    return { success: "Event deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete event." };
  }
}
