import type { SupabaseClient } from "@supabase/supabase-js";
import {
  lettersForSelection,
  uniqueLetters,
  type SoundMatchLetter,
} from "@/lib/games/sound-match";

const FC_QUIZ_TITLES = ["FC - Q1", "FC - Q2"];

const OPTION_KEYS = ["a", "b", "c", "d"] as const;

type QuizQuestionRow = {
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  question_audio_pa_url: string | null;
};

function glyphFromCorrectAnswer(row: QuizQuestionRow): string | null {
  const key = String(row.correct_answer ?? "").trim().toLowerCase();
  const options: Record<string, string | null> = {
    a: row.option_a,
    b: row.option_b,
    c: row.option_c,
    d: row.option_d,
  };
  const byLetter = options[key];
  if (typeof byLetter === "string" && byLetter.trim()) return byLetter.trim();

  const index = Number.parseInt(key, 10);
  if (Number.isInteger(index) && index >= 0 && index < OPTION_KEYS.length) {
    const value = options[OPTION_KEYS[index]];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

export async function loadSoundMatchLetters(
  supabase: SupabaseClient
): Promise<{ letters: SoundMatchLetter[]; loadError: string | null }> {
  const { data: quizzes, error: quizError } = await supabase
    .from("quizzes")
    .select("id, title")
    .in("title", FC_QUIZ_TITLES);

  if (quizError) {
    return { letters: [], loadError: quizError.message };
  }

  const quizIds = (quizzes ?? []).map((quiz) => quiz.id as string).filter(Boolean);
  if (quizIds.length === 0) {
    return { letters: [], loadError: "Foundational letter quizzes are not available yet." };
  }

  const { data: questions, error: questionError } = await supabase
    .from("quiz_questions")
    .select("option_a, option_b, option_c, option_d, correct_answer, question_audio_pa_url")
    .in("quiz_id", quizIds);

  if (questionError) {
    return { letters: [], loadError: questionError.message };
  }

  const wanted = new Set(lettersForSelection(["full"]));
  const byGlyph = new Map<string, SoundMatchLetter>();

  for (const row of (questions ?? []) as QuizQuestionRow[]) {
    const audio = typeof row.question_audio_pa_url === "string" ? row.question_audio_pa_url.trim() : "";
    const glyph = glyphFromCorrectAnswer(row);
    if (!audio || !glyph || !wanted.has(glyph) || byGlyph.has(glyph)) continue;
    byGlyph.set(glyph, { glyph, audioUrl: audio });
  }

  return { letters: uniqueLetters([...wanted]).flatMap((glyph) => {
    const letter = byGlyph.get(glyph);
    return letter ? [letter] : [];
  }), loadError: null };
}
