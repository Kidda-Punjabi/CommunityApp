import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ITEM_DONE_AT } from "./levels";
import type { PractiseSkill } from "./types";
import { WEEK_EXTRA_SENTENCES, weekExtraById } from "./week-extras";
import { parseWeekCard, weekItemsFromCards, type WeekCard, type WeekItem } from "./week-cards";

export const WEEK_COUNT = 12;
/** Weeks 11 and 12 have no flashcards of their own, so they recap the course. */
const LAST_WEEK_WITH_CARDS = 10;
const RECAP_SIZE = 60;

export type WeekSkillSummary = { skill: PractiseSkill; label: string; creditPct: number; done: number; total: number };
export type WeekDeck = { deckId: string; name: string };
export type WeekPool = {
  week: number;
  lessonId: string;
  title: string;
  words: WeekItem[];
  sentences: WeekItem[];
  decks: WeekDeck[];
};

const LABELS: Record<PractiseSkill, string> = { words: "Words", grammar: "Grammar", listening: "Listening", speaking: "Speaking" };
export const WEEK_SKILLS: PractiseSkill[] = ["words", "grammar", "listening", "speaking"];

function cleanTitle(title: string) {
  return title.replace(/\s*[-–—]\s*Week\s*\d+\s*$/i, "").trim();
}

async function cardsForWeeks(supabase: SupabaseClient, lessonIds: string[]) {
  const { data: links, error } = await supabase.from("set_course_links").select("deck_id, lesson_id").in("lesson_id", lessonIds);
  if (error) throw error;
  const deckIds = [...new Set((links ?? []).map((l) => l.deck_id as string))];
  if (!deckIds.length) return { cards: [] as WeekCard[], deckIds };
  const { data: cards, error: cardsError } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, romanised")
    .in("deck_id", deckIds)
    .order("id");
  if (cardsError) throw cardsError;
  return { cards: (cards ?? []) as WeekCard[], deckIds };
}

export async function loadWeekPool(supabase: SupabaseClient, week: number): Promise<WeekPool | null> {
  if (!Number.isInteger(week) || week < 1 || week > WEEK_COUNT) return null;
  const { data: course } = await supabase.from("courses").select("id").eq("name", "Beginners Course").maybeSingle();
  if (!course) return null;
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, title, lesson_number")
    .eq("course_id", course.id)
    .lte("lesson_number", Math.max(week, LAST_WEEK_WITH_CARDS));
  if (error) throw error;
  const lesson = (lessons ?? []).find((l) => l.lesson_number === week);
  if (!lesson) return null;
  const recap = week > LAST_WEEK_WITH_CARDS;
  const ids = recap ? (lessons ?? []).filter((l) => l.lesson_number <= LAST_WEEK_WITH_CARDS).map((l) => l.id as string) : [lesson.id as string];
  const { cards, deckIds } = await cardsForWeeks(supabase, ids);
  const items = [...weekItemsFromCards(cards), ...(WEEK_EXTRA_SENTENCES[week] ?? [])];
  const take = (list: WeekItem[]) => (recap ? list.slice(0, RECAP_SIZE) : list);

  let decks: WeekDeck[] = [];
  if (!recap && deckIds.length) {
    const { data } = await supabase.from("flashcard_sets").select("id, name").in("id", deckIds).order("name");
    decks = (data ?? []).map((d) => ({ deckId: d.id as string, name: d.name as string }));
  }
  return {
    week,
    lessonId: lesson.id as string,
    title: cleanTitle(lesson.title as string),
    words: take(items.filter((i) => i.kind === "word")),
    sentences: take(items.filter((i) => i.kind === "sentence")),
    decks,
  };
}

/** Sentences with enough words to rebuild from tiles. */
export function grammarItems(pool: WeekPool) {
  return pool.sentences.filter((s) => s.r.split(/\s+/).filter(Boolean).length >= 3);
}

export function poolForSkill(pool: WeekPool, skill: PractiseSkill): WeekItem[] {
  if (skill === "words") return pool.words;
  if (skill === "grammar") return grammarItems(pool);
  return pool.sentences.length >= 4 ? pool.sentences : [...pool.sentences, ...pool.words];
}

export function summariseWeek(pool: WeekPool, progress: Map<string, number>): WeekSkillSummary[] {
  return WEEK_SKILLS.map((skill) => {
    const items = poolForSkill(pool, skill);
    const count = (id: string) => progress.get(`${skill}:${id}`) ?? 0;
    const credit = items.reduce((sum, i) => sum + Math.min(count(i.id), ITEM_DONE_AT), 0);
    const raw = items.length ? Math.round((credit / (items.length * ITEM_DONE_AT)) * 100) : 0;
    const done = items.filter((i) => count(i.id) >= ITEM_DONE_AT).length;
    // Only a fully finished skill reads 100%.
    const creditPct = done === items.length && items.length > 0 ? 100 : credit > 0 ? Math.min(99, Math.max(1, raw)) : 0;
    return { skill, label: LABELS[skill], creditPct, done, total: items.length };
  }).filter((s) => s.total > 0);
}

/** The Punjabi to speak aloud for a flashcard, or null if it isn't a usable card. */
export async function weekCardScript(supabase: SupabaseClient, cardId: string) {
  const extra = weekExtraById(cardId);
  if (extra) return extra.g;
  const { data } = await supabase.from("flashcards").select("id, front_text, back_text, romanised").eq("id", cardId).maybeSingle();
  return data ? (parseWeekCard(data as WeekCard)?.g ?? null) : null;
}
