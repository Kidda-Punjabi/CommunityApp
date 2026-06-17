"use server";

import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ADMIN_PATH = "/admin/content";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user)) {
    throw new Error("Unauthorized");
  }

  return supabase;
}

async function uploadFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  file: File
) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}

export type ActionResult = { error?: string; success?: string };

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
    const audioFile = formData.get("audio") as File;

    if (!courseId || !title || Number.isNaN(lessonNumber)) {
      return { error: "Course, lesson number, and title are required." };
    }

    let audioUrl: string | null = null;
    if (audioFile?.size > 0) {
      audioUrl = await uploadFile(supabase, "audio-files", audioFile);
    }

    const { error } = await supabase.from("lessons").insert({
      course_id: courseId,
      lesson_number: lessonNumber,
      title,
      is_free: isFree,
      audio_url: audioUrl,
    });

    if (error) return { error: error.message };

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
    const audioFile = formData.get("audio") as File;

    const updates: Record<string, unknown> = {
      course_id: courseId,
      lesson_number: lessonNumber,
      title,
      is_free: isFree,
    };

    if (audioFile?.size > 0) {
      updates.audio_url = await uploadFile(supabase, "audio-files", audioFile);
    }

    const { error } = await supabase.from("lessons").update(updates).eq("id", id);
    if (error) return { error: error.message };

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
    if (error) return { error: error.message };
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
    const courseId = formData.get("course_id") as string;
    const levelNumber = parseInt(formData.get("level_number") as string, 10);
    const title = formData.get("title") as string;

    if (!courseId || !title || Number.isNaN(levelNumber)) {
      return { error: "Course, level number, and title are required." };
    }

    const { error } = await supabase.from("quizzes").insert({
      course_id: courseId,
      level_number: levelNumber,
      title,
    });

    if (error) return { error: error.message };

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
    if (error) return { error: error.message };
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

    if (error) return { error: error.message };

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
    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Question deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete question." };
  }
}

// ---- Flashcards ----

export async function createFlashcard(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const deckName = formData.get("deck_name") as string;
    const frontText = formData.get("front_text") as string;
    const backText = formData.get("back_text") as string;

    if (!deckName || !frontText || !backText) {
      return { error: "All fields are required." };
    }

    const { error } = await supabase.from("flashcards").insert({
      deck_name: deckName,
      front_text: frontText,
      back_text: backText,
    });

    if (error) return { error: error.message };

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
    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Flashcard deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete flashcard." };
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
    const photoFile = formData.get("photo") as File;

    if (!name) return { error: "Name is required." };

    let photoUrl: string | null = null;
    if (photoFile?.size > 0) {
      photoUrl = await uploadFile(supabase, "profile-photos", photoFile);
    }

    const { error } = await supabase.from("teachers").insert({
      name,
      bio,
      specialty,
      contact_link: contactLink,
      photo_url: photoUrl,
      display_order: displayOrder,
    });

    if (error) return { error: error.message };

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
    const photoFile = formData.get("photo") as File;

    const updates: Record<string, unknown> = {
      name,
      bio,
      specialty,
      contact_link: contactLink,
      display_order: displayOrder,
    };

    if (photoFile?.size > 0) {
      updates.photo_url = await uploadFile(supabase, "profile-photos", photoFile);
    }

    const { error } = await supabase.from("teachers").update(updates).eq("id", id);
    if (error) return { error: error.message };

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
    if (error) return { error: error.message };
    revalidatePath(ADMIN_PATH);
    return { success: "Teacher deleted." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete teacher." };
  }
}
