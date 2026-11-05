"use server";

import { revalidatePath } from "next/cache";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import { shuffle } from "@/lib/practise/content";
import { knownSlotsBySkill, pickMix, seenAnywhere } from "@/lib/practise/round-mix";
import { DAILY_XP_GOAL, ITEM_DONE_AT, ROUND_SIZE, XP_PER_CORRECT, XP_ROUND_BONUS } from "@/lib/practise/levels";
import { loadProgress } from "@/lib/practise/load-home";
import type { PractiseSkill, RoundAnswer, RoundQuestion } from "@/lib/practise/types";
import type { WeekItem } from "@/lib/practise/week-cards";
import { loadWeekPool, poolForSkill, summariseWeek, WEEK_SKILLS, type WeekPool, type WeekSkillSummary } from "@/lib/practise/week-content";
import { recordStreakActivity } from "@/lib/progress/streak";
import { createClient } from "@/lib/supabase/server";

async function requireWeek(week: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const actor = await resolveCourseActor(supabase, user.id);
  if (actor.kind === "kid") throw new Error("Not available on kid profiles.");
  const pool = await loadWeekPool(supabase, week);
  if (!pool) throw new Error("Unknown week.");
  return { supabase, userId: user.id, pool };
}

function answerOf(i: WeekItem) {
  return { gurmukhi: i.g, romanised: i.r, english: i.e };
}

function distractors(item: WeekItem, pool: WeekItem[], text: (i: WeekItem) => string) {
  const seen = new Set([text(item)]);
  const out: WeekItem[] = [];
  for (const p of shuffle(pool)) {
    if (out.length === 3) break;
    if (seen.has(text(p))) continue;
    seen.add(text(p));
    out.push(p);
  }
  return out;
}

/** Mostly new items with a review slot. A week is a short list, so review fills in once the new ones run out. */
function pick(items: WeekItem[], skill: PractiseSkill, progress: Map<string, number>, n: number, used: Set<string>, knownSlots: number) {
  const count = (i: WeekItem) => progress.get(`${skill}:${i.id}`) ?? 0;
  const free = items.filter((i) => !used.has(i.id));
  const seen = free.filter((i) => seenAnywhere(progress, i.id));
  const known = [...shuffle(seen.filter((i) => count(i) < ITEM_DONE_AT)), ...shuffle(seen.filter((i) => count(i) >= ITEM_DONE_AT))];
  const mix = pickMix(shuffle(free.filter((i) => !seenAnywhere(progress, i.id))), known, n, knownSlots);
  const picked = [...mix.fresh, ...mix.review, ...mix.known.slice(0, mix.shortOfNew)];
  for (const i of picked) used.add(i.id);
  return picked;
}

function questions(pool: WeekPool, skill: PractiseSkill, progress: Map<string, number>, n: number, used: Set<string>, knownSlots: number): RoundQuestion[] {
  const items = poolForSkill(pool, skill);
  const everything = [...pool.words, ...pool.sentences];
  const choosePunjabi = (i: WeekItem, uncounted: boolean): RoundQuestion => ({
    skill,
    itemId: i.id,
    type: "choice",
    uncounted,
    heading: "Pick the Punjabi",
    prompt: i.e,
    audioKey: i.id,
    options: shuffle([i, ...distractors(i, i.kind === "word" ? pool.words : pool.sentences.length >= 4 ? pool.sentences : everything, (p) => p.g)]).map((o) => ({ id: o.id, label: o.g, sub: o.r || undefined })),
    answerId: i.id,
    answer: answerOf(i),
  });
  const chooseMeaning = (i: WeekItem): RoundQuestion => ({
    skill,
    itemId: i.id,
    type: "choice",
    uncounted: true,
    heading: "Pick the meaning",
    prompt: i.g,
    audioKey: i.id,
    options: shuffle([i, ...distractors(i, everything, (p) => p.e)]).map((o) => ({ id: o.id, label: o.e })),
    answerId: i.id,
    answer: answerOf(i),
  });
  return pick(items, skill, progress, n, used, knownSlots).map((i): RoundQuestion => {
    if (skill === "grammar") {
      return { skill, itemId: i.id, type: "tiles", heading: "Build the sentence", prompt: i.e, tiles: shuffle(i.r.split(/\s+/).filter(Boolean)), answer: answerOf(i) };
    }
    if (skill === "listening") {
      return {
        skill,
        itemId: i.id,
        type: "listen",
        heading: "What did you hear?",
        prompt: "Listen, then pick the meaning.",
        audioKey: i.id,
        options: shuffle([i, ...distractors(i, everything, (p) => p.e)]).map((o) => ({ id: o.id, label: o.e })),
        answerId: i.id,
        answer: answerOf(i),
        fallback: chooseMeaning(i),
      };
    }
    if (skill === "words" && (progress.get(`words:${i.id}`) ?? 0) === 0) return choosePunjabi(i, false);
    return { skill, itemId: i.id, type: "say", heading: "Say it in Punjabi", prompt: i.e, audioKey: i.id, answer: answerOf(i), fallback: choosePunjabi(i, skill !== "words") };
  });
}

export async function startWeekRound(week: number): Promise<RoundQuestion[]> {
  const { supabase, userId, pool } = await requireWeek(week);
  const progress = await loadProgress(supabase, userId);
  const skills = WEEK_SKILLS.filter((s) => poolForSkill(pool, s).length > 0);
  if (!skills.length) throw new Error("No practice for this week yet.");
  const base = Math.floor(ROUND_SIZE / skills.length);
  let spare = ROUND_SIZE % skills.length;
  const used: Record<string, Set<string>> = {};
  const knownSlots = knownSlotsBySkill(skills, ROUND_SIZE);
  const out = skills.flatMap((skill) => {
    const n = base + (spare > 0 ? 1 : 0);
    if (spare > 0) spare -= 1;
    // A sentence can appear once per round across grammar, listening and speaking.
    const key = skill === "words" ? "words" : "sentences";
    used[key] ??= new Set();
    return questions(pool, skill, progress, n, used[key], knownSlots.get(skill) ?? 0);
  });
  return shuffle(out);
}

export type WeekRoundResult = {
  correct: number;
  total: number;
  skills: WeekSkillSummary[];
  xpEarned: number;
  xpToday: number;
  xpGoal: number;
  streak: number | null;
};

export async function submitWeekRound(week: number, answers: RoundAnswer[], localDate: string): Promise<WeekRoundResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error("Invalid round.");
  const { supabase, userId, pool } = await requireWeek(week);
  const clean = answers
    .filter((a) => WEEK_SKILLS.includes(a.skill) && poolForSkill(pool, a.skill).some((i) => i.id === a.itemId))
    .slice(0, ROUND_SIZE * 2);
  const progress = await loadProgress(supabase, userId);
  const now = new Date().toISOString();

  for (const skill of WEEK_SKILLS) {
    const mine = clean.filter((a) => a.skill === skill && !a.uncounted);
    if (!mine.length) continue;
    const byItem = new Map<string, { correct: number; attempts: number; last: boolean }>();
    for (const a of mine) {
      const row = byItem.get(a.itemId) ?? { correct: 0, attempts: 0, last: false };
      row.attempts += 1;
      row.correct += a.correct ? 1 : 0;
      row.last = a.correct;
      byItem.set(a.itemId, row);
    }
    const { data: existing } = await supabase
      .from("practise_progress")
      .select("item_id, attempts")
      .eq("user_id", userId)
      .eq("skill", skill)
      .in("item_id", [...byItem.keys()]);
    const attemptsById = new Map((existing ?? []).map((r) => [r.item_id as string, r.attempts as number]));
    const rows = [...byItem.entries()].map(([itemId, r]) => {
      const next = (progress.get(`${skill}:${itemId}`) ?? 0) + r.correct;
      progress.set(`${skill}:${itemId}`, next);
      return { user_id: userId, item_id: itemId, skill, correct_count: next, attempts: (attemptsById.get(itemId) ?? 0) + r.attempts, last_correct: r.last, last_seen_at: now };
    });
    const { error } = await supabase.from("practise_progress").upsert(rows);
    if (error) throw error;
  }

  const { data: playedToday } = await supabase.from("practise_rounds").select("xp").eq("user_id", userId).eq("local_date", localDate);
  const xpBefore = (playedToday ?? []).reduce((sum, r) => sum + Number(r.xp ?? 0), 0);
  let xpEarned = 0;
  if (clean.length) {
    const wanted = clean.filter((a) => a.correct).length * XP_PER_CORRECT + XP_ROUND_BONUS;
    const { data: granted, error } = await supabase.rpc("grant_profile_xp", { p_xp: wanted, p_source: "game", p_source_id: crypto.randomUUID() });
    if (error) console.error("week practice xp failed", error.message);
    else xpEarned = Number(granted ?? 0);
  }
  const { data: profile } = await supabase.from("profiles").select("kidda_level").eq("id", userId).maybeSingle();
  const roundRows = WEEK_SKILLS.filter((skill) => clean.some((a) => a.skill === skill)).map((skill, i) => {
    const mine = clean.filter((a) => a.skill === skill);
    return { xp: i === 0 ? xpEarned : 0, user_id: userId, level: (profile?.kidda_level as number | null) ?? 0, skill, correct: mine.filter((a) => a.correct).length, total: mine.length, local_date: localDate };
  });
  if (roundRows.length) {
    const { error } = await supabase.from("practise_rounds").insert(roundRows);
    if (error) throw error;
  }
  let streak: number | null = null;
  try {
    streak = (await recordStreakActivity(supabase, userId, localDate)).current_streak;
  } catch {
    // The round still counts if the streak service is unavailable.
  }
  revalidatePath(`/dashboard/learn/beginners/week/${week}`);
  return {
    correct: clean.filter((a) => a.correct).length,
    total: clean.length,
    skills: summariseWeek(pool, progress),
    xpEarned,
    xpToday: xpBefore + xpEarned,
    xpGoal: DAILY_XP_GOAL,
    streak,
  };
}
