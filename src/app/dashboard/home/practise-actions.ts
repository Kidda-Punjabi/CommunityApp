"use server";

import { revalidatePath } from "next/cache";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import { synthesizeSpeech } from "@/lib/elevenlabs/server";
import { publicUrlForAudioPath } from "@/lib/audio/storage";
import { recordStreakActivity } from "@/lib/progress/streak";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { weekCardScript } from "@/lib/practise/week-content";
import {
  grammarSentencesFor,
  isItemDone,
  itemById,
  poolFor,
  sentencesAt,
  shuffle,
  skillsForLevel,
  wordsAt,
  wordsBelow,
  type Item,
} from "@/lib/practise/content";
import { knownSlotsBySkill, pickMix, seenAnywhere } from "@/lib/practise/round-mix";
import { DAILY_XP_GOAL, LEVELS, ROUND_SIZE, XP_PER_CORRECT, XP_ROUND_BONUS } from "@/lib/practise/levels";
import { cooldownDays, loadCheckParts, loadProgress, summariseSkill } from "@/lib/practise/load-home";
import type {
  CheckQuestion,
  CheckResult,
  LevelPreview,
  PractiseSkill,
  RoundAnswer,
  RoundOption,
  RoundQuestion,
  RoundResult,
  SkillRoundScore,
} from "@/lib/practise/types";

const AUDIO_BUCKET = "lesson-audio";
const SKILLS: PractiseSkill[] = ["words", "grammar", "listening", "speaking"];

async function requireLearner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const actor = await resolveCourseActor(supabase, user.id);
  if (actor.kind === "kid") throw new Error("Not available on kid profiles.");
  const { data } = await supabase.from("profiles").select("kidda_level").eq("id", user.id).maybeSingle();
  const level = data?.kidda_level as number | null;
  if (level == null) throw new Error("Find your level first.");
  return { supabase, userId: user.id, level };
}

function sample<T>(list: T[], n: number) {
  return shuffle(list).slice(0, n);
}

function wordOption(i: Item): RoundOption {
  return { id: i.id, label: i.g, sub: i.r };
}

function distractors(item: Item, pool: Item[], n: number, text: (i: Item) => string) {
  const seen = new Set([text(item)]);
  const out: Item[] = [];
  const near = shuffle(pool.filter((p) => p.t === item.t));
  for (const p of [...near, ...shuffle(pool)]) {
    if (out.length === n) break;
    if (seen.has(text(p))) continue;
    seen.add(text(p));
    out.push(p);
  }
  return out;
}

/** New items, then a review slot. Short of new sentences, it borrows new words so the round stays mostly new. */
function pickRoundItems(pool: Item[], skill: PractiseSkill, progress: Map<string, number>, n: number, used: Set<string>, knownSlots: number, level: number) {
  const count = (i: Item) => progress.get(`${skill}:${i.id}`) ?? 0;
  const available = pool.filter((i) => !used.has(i.id));
  const unseen = shuffle(available.filter((i) => !seenAnywhere(progress, i.id)));
  const seen = available.filter((i) => seenAnywhere(progress, i.id));
  const known = [...shuffle(seen.filter((i) => !isItemDone(skill, count(i)))), ...shuffle(seen.filter((i) => isItemDone(skill, count(i))))];
  const mix = pickMix(unseen, known, n, knownSlots);
  const borrowed = skill === "words" ? [] : freshWords(level, progress, mix.shortOfNew, used);
  const stillShort = mix.shortOfNew - borrowed.length;
  const picked = [...mix.fresh, ...mix.review, ...mix.known.slice(0, stillShort)];
  for (const item of [...picked, ...borrowed]) used.add(item.id);
  return { picked: shuffle(picked), borrowed };
}

function freshWords(level: number, progress: Map<string, number>, n: number, used: Set<string>) {
  if (n <= 0 || !skillsForLevel(level).includes("words")) return [];
  return shuffle(wordsAt(level).filter((w) => !used.has(w.id) && !seenAnywhere(progress, w.id))).slice(0, n);
}

function answerOf(i: Item) {
  return { gurmukhi: i.g, romanised: i.r, english: i.e };
}

function soundQuestion(i: Item, pool: Item[]): RoundQuestion {
  if (i.k === "p") {
    const letters = i.g.split("/").map((s) => s.trim());
    const which = Math.random() < 0.5 ? 0 : 1;
    return {
      skill: "listening",
      itemId: i.id,
      type: "listen",
      heading: "Which sound did you hear?",
      prompt: i.e,
      audioKey: `${i.id}:${which}`,
      options: letters.map((l, n) => ({ id: String(n), label: `${l}ਾ` })),
      answerId: String(which),
      answer: { gurmukhi: `${letters[which]}ਾ`, romanised: i.r.split("/")[which]?.trim() ?? "", english: i.e },
    };
  }
  const others = distractors(i, pool.filter((p) => p.k === "v"), 3, (p) => p.g);
  return {
    skill: "listening",
    itemId: i.id,
    type: "listen",
    heading: "Which sound did you hear?",
    prompt: "Listen, then pick the sound.",
    audioKey: i.id,
    options: shuffle([i, ...others]).map((o) => ({ id: o.id, label: o.g, sub: o.r })),
    answerId: i.id,
    answer: { gurmukhi: i.g, romanised: i.r, english: "" },
  };
}

function savedLabel(skill: PractiseSkill, item: Item) {
  if (skill === "grammar") return item.e;
  if (skill === "words") return [item.r || item.g, item.e].filter(Boolean).join(" · ");
  return item.e || item.r || item.g;
}

function questionsFor(skill: PractiseSkill, level: number, progress: Map<string, number>, n: number, used: Set<string>, knownSlots: number): RoundQuestion[] {
  const pool = poolFor(level, skill);
  if (!pool.length || n <= 0) return [];
  if (skill === "grammar") {
    const count = (i: Item) => progress.get(`grammar:${i.id}`) ?? 0;
    const open = pool.filter((r) => !isItemDone("grammar", count(r)));
    // Next rule first. A rule with few sentences hands over to the one after it.
    const rules = [...open, ...pool.filter((r) => !open.includes(r))].sort((x, y) => Number(isItemDone("grammar", count(x))) - Number(isItemDone("grammar", count(y))) || count(x) - count(y));
    const candidates = rules.flatMap((rule) => shuffle(grammarSentencesFor(rule)).map((sentence) => ({ rule, sentence })));
    const unique = (list: typeof candidates) => {
      const seenIds = new Set<string>();
      return list.filter(({ sentence }) => !used.has(sentence.id) && !seenIds.has(sentence.id) && Boolean(seenIds.add(sentence.id)));
    };
    const free = unique(candidates);
    const mix = pickMix(free.filter((c) => !seenAnywhere(progress, c.sentence.id)), free.filter((c) => seenAnywhere(progress, c.sentence.id)), n, knownSlots);
    const borrowed = freshWords(level, progress, mix.shortOfNew, used);
    const chosen = [...mix.fresh, ...mix.review, ...mix.known.slice(0, mix.shortOfNew - borrowed.length)];
    const out: RoundQuestion[] = chosen.map(({ rule, sentence: s }) => {
      used.add(s.id);
      return { skill, itemId: rule.id, seenId: s.id, type: "tiles", heading: rule.e, prompt: s.e, tiles: shuffle(s.r.split(/\s+/)), answer: answerOf(s) };
    });
    for (const word of borrowed) used.add(word.id);
    return [...out, ...borrowed.map((word) => questionsForItem(word, "words", "words", level, progress, wordsAt(level)))];
  }
  const { picked, borrowed } = pickRoundItems(pool, skill, progress, n, used, knownSlots, level);
  return [
    ...picked.map((i) => questionsForItem(i, skill, skill, level, progress, pool)),
    ...borrowed.map((word) => questionsForItem(word, skill, "words", level, progress, wordsAt(level))),
  ];
}

/** `format` is how it is asked, `skill` is what it counts towards. A borrowed word can be heard or said but counts as a word. */
function questionsForItem(i: Item, format: PractiseSkill, skill: PractiseSkill, level: number, progress: Map<string, number>, pool: Item[]): RoundQuestion {
  const readChoice = (i: Item): RoundQuestion => ({
    skill,
    itemId: i.id,
    type: "choice",
    uncounted: true,
    heading: "Pick the meaning",
    prompt: i.g,
    options: shuffle([i, ...distractors(i, pool, 3, (p) => p.e)]).map((o) => ({ id: o.id, label: o.e })),
    answerId: i.id,
    audioKey: i.id,
    answer: answerOf(i),
  });
  const pickPunjabi = (i: Item): RoundQuestion => ({
    skill,
    itemId: i.id,
    type: "choice",
    uncounted: skill !== "words",
    heading: "Pick the Punjabi",
    prompt: i.e,
    audioKey: i.id,
    options: shuffle([i, ...distractors(i, pool, 3, (p) => p.g)]).map(wordOption),
    answerId: i.id,
    answer: answerOf(i),
  });
  {
    if (format === "words") {
      if ((progress.get(`words:${i.id}`) ?? 0) === 0) {
        const others = distractors(i, pool, 3, (p) => p.g);
        return {
          skill,
          itemId: i.id,
          type: "choice",
          heading: "Pick the Punjabi",
          prompt: i.e,
          options: shuffle([i, ...others]).map(wordOption),
          answerId: i.id,
          audioKey: i.id,
          answer: answerOf(i),
        };
      }
      return { skill, itemId: i.id, type: "say", heading: "Say it in Punjabi", prompt: i.e, audioKey: i.id, answer: answerOf(i), fallback: pickPunjabi(i) };
    }
    if (format === "listening") {
      if (level === 0) return soundQuestion(i, pool);
      const others = distractors(i, pool, 3, (p) => p.e);
      return {
        skill,
        itemId: i.id,
        type: "listen",
        heading: "What did you hear?",
        prompt: "Listen, then pick the meaning.",
        audioKey: i.id,
        options: shuffle([i, ...others]).map((o) => ({ id: o.id, label: o.e })),
        answerId: i.id,
        answer: answerOf(i),
        fallback: readChoice(i),
      };
    }
    if (level === 0) {
      return {
        skill,
        itemId: i.id,
        type: "say",
        heading: "Say this sound",
        prompt: i.g,
        promptIsGurmukhi: true,
        audioKey: i.id,
        selfRateOnly: true,
        answer: { gurmukhi: i.g, romanised: i.r, english: "" },
      };
    }
    return { skill, itemId: i.id, type: "say", heading: "Say it in Punjabi", prompt: i.e, audioKey: i.id, answer: answerOf(i), fallback: pickPunjabi(i) };
  }
}

/** One round mixes every skill at this level. Play from home or from a skill page. */
export async function startRound(): Promise<RoundQuestion[]> {
  const { supabase, userId, level } = await requireLearner();
  const progress = await loadProgress(supabase, userId);
  const skills = skillsForLevel(level);
  const base = Math.floor(ROUND_SIZE / skills.length);
  let spare = ROUND_SIZE % skills.length;
  const used = new Set<string>();
  const knownSlots = knownSlotsBySkill(skills, ROUND_SIZE);
  const questions = skills.flatMap((skill) => {
    const n = base + (spare > 0 ? 1 : 0);
    if (spare > 0) spare -= 1;
    return questionsFor(skill, level, progress, n, used, knownSlots.get(skill) ?? 0);
  });
  return shuffle(questions);
}

export async function submitRound(answers: RoundAnswer[], localDate: string): Promise<RoundResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error("Invalid round.");
  const { supabase, userId, level } = await requireLearner();
  const clean = answers
    .filter((a) => SKILLS.includes(a.skill) && itemById(a.itemId))
    .slice(0, ROUND_SIZE * 2);
  const progress = await loadProgress(supabase, userId);
  const before = new Map(SKILLS.map((skill) => [skill, summariseSkill(level, skill, progress)]));
  const ticked: string[] = [];
  const saved: string[] = [];
  const now = new Date().toISOString();

  // Remember which sentences were built, so they stop counting as new. Rule stars read rule ids only.
  const builtIds = [...new Set(clean.map((a) => a.seenId).filter((id): id is string => Boolean(id && itemById(id))))].filter((id) => !progress.has(`grammar:${id}`));
  if (builtIds.length) {
    await supabase.from("practise_progress").upsert(
      builtIds.map((id) => ({ user_id: userId, item_id: id, skill: "grammar", correct_count: 0, attempts: 1, last_correct: null, last_seen_at: now }))
    );
  }

  for (const skill of SKILLS) {
    const mine = clean.filter((a) => a.skill === skill && !a.uncounted);
    if (!mine.length) continue;
    const byItem = new Map<string, { correct: number; attempts: number; last: boolean }>();
    for (const a of mine) {
      const row = byItem.get(a.itemId) ?? { correct: 0, attempts: 0, last: false };
      row.attempts += 1;
      row.correct += a.correct ? 1 : 0;
      row.last = a.correct;
      byItem.set(a.itemId, row);
      if (a.correct) {
        const item = itemById(a.itemId);
        const label = item ? savedLabel(skill, item) : "";
        if (label && !saved.includes(label)) saved.push(label);
      }
    }
    const { data: existing } = await supabase
      .from("practise_progress")
      .select("item_id, attempts")
      .eq("user_id", userId)
      .eq("skill", skill)
      .in("item_id", [...byItem.keys()]);
    const attemptsById = new Map((existing ?? []).map((r) => [r.item_id as string, r.attempts as number]));
    const rows = [...byItem.entries()].map(([itemId, r]) => {
      const prev = progress.get(`${skill}:${itemId}`) ?? 0;
      const next = prev + r.correct;
      if (!isItemDone(skill, prev) && isItemDone(skill, next)) {
        const item = itemById(itemId);
        if (item) ticked.push(savedLabel(skill, item));
      }
      progress.set(`${skill}:${itemId}`, next);
      return {
        user_id: userId,
        item_id: itemId,
        skill,
        correct_count: next,
        attempts: (attemptsById.get(itemId) ?? 0) + r.attempts,
        last_correct: r.last,
        last_seen_at: now,
      };
    });
    if (rows.length) {
      const { error } = await supabase.from("practise_progress").upsert(rows);
      if (error) throw error;
    }
  }

  const { data: playedToday } = await supabase
    .from("practise_rounds")
    .select("id, xp")
    .eq("user_id", userId)
    .eq("local_date", localDate);
  const xpBefore = (playedToday ?? []).reduce((sum, r) => sum + Number(r.xp ?? 0), 0);
  // Uses the app's XP ledger, so it counts everywhere XP counts, within the daily game cap.
  let xpEarned = 0;
  const wanted = clean.filter((a) => a.correct).length * XP_PER_CORRECT + XP_ROUND_BONUS;
  if (clean.length) {
    const { data: granted, error: xpError } = await supabase.rpc("grant_profile_xp", { p_xp: wanted, p_source: "game", p_source_id: crypto.randomUUID() });
    if (xpError) console.error("practise xp failed", xpError.message);
    else xpEarned = Number(granted ?? 0);
  }
  const roundRows = SKILLS.filter((skill) => clean.some((a) => a.skill === skill)).map((skill, i) => {
    const mine = clean.filter((a) => a.skill === skill);
    return {
      xp: i === 0 ? xpEarned : 0,
      user_id: userId,
      level,
      skill,
      correct: mine.filter((a) => a.correct).length,
      total: mine.length,
      local_date: localDate,
    };
  });
  if (roundRows.length) {
    const { error: roundError } = await supabase.from("practise_rounds").insert(roundRows);
    if (roundError) throw roundError;
  }

  let streak: number | null = null;
  try {
    const s = await recordStreakActivity(supabase, userId, localDate);
    streak = s.current_streak;
  } catch {
    // The round still counts if the streak service is unavailable.
  }
  revalidatePath("/dashboard/home");
  const skills: SkillRoundScore[] = SKILLS.filter((skill) => clean.some((a) => a.skill === skill)).map((skill) => {
    const earlier = before.get(skill)!;
    const later = summariseSkill(level, skill, progress);
    return {
      skill,
      label: later.label,
      practisedBefore: earlier.practised,
      practisedAfter: later.practised,
      total: later.total,
      creditBefore: earlier.creditPct,
      creditAfter: later.creditPct,
    };
  });
  return {
    correct: clean.filter((a) => a.correct).length,
    total: clean.length,
    ticked,
    saved,
    skills,
    xpEarned,
    xpToday: xpBefore + xpEarned,
    xpGoal: DAILY_XP_GOAL,
    streak,
    streakExtended: (playedToday ?? []).length === 0 && roundRows.length > 0,
  };
}

/** Audio is generated the first time anyone needs it, then served from storage. */
export async function getPractiseAudio(key: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [id, part] = key.split(":");
  const item = itemById(id);
  // Week practice items are flashcards, keyed by the card's id.
  const weekScript = !item && /^([0-9a-f-]{36}|wk\d+-\d+)$/.test(id) ? await weekCardScript(supabase, id) : null;
  if (!item && !weekScript) return null;
  let script = item?.g ?? weekScript!;
  if (item?.k === "p") {
    const letter = item.g.split("/")[Number(part)]?.trim();
    if (!letter) return null;
    script = `${letter}ਾ`;
  }
  const admin = createServiceRoleClient();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const { data: cached } = await admin.from("practise_audio").select("storage_path").eq("audio_key", key).maybeSingle();
  if (cached?.storage_path) return publicUrlForAudioPath(base, AUDIO_BUCKET, cached.storage_path as string);
  try {
    const { audio } = await synthesizeSpeech({ text: script });
    const path = `practise/${key.replace(":", "-")}.mp3`;
    const { error } = await admin.storage.from(AUDIO_BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (error) throw error;
    await admin.from("practise_audio").upsert({ audio_key: key, storage_path: path });
    return publicUrlForAudioPath(base, AUDIO_BUCKET, path);
  } catch (error) {
    console.error("practise audio failed", error);
    return null;
  }
}

export async function getLevelPreview(level: number): Promise<LevelPreview> {
  const { level: current } = await requireLearner();
  if (!Number.isInteger(level) || level < 0 || level > 9) throw new Error("Unknown level.");
  const empty = new Map<string, number>();
  return {
    meta: LEVELS[level],
    state: level < current ? "passed" : level > current ? "locked" : "current",
    skills: skillsForLevel(level).map((s) => {
      const sum = summariseSkill(level, s, empty);
      return { label: `${sum.label}: ${sum.total} ${sum.unit}`, rows: sum.rows.map((r) => r.label) };
    }),
  };
}

export async function startLevelCheck(part: "words" | "listening"): Promise<{ checkId: string; questions: CheckQuestion[] }> {
  const { supabase, userId, level } = await requireLearner();
  const progress = await loadProgress(supabase, userId);
  const ready = skillsForLevel(level).every((s) => summariseSkill(level, s, progress).pct === 100);
  if (!ready) throw new Error("Finish your checklist first.");
  const admin = createServiceRoleClient();
  const state = (await loadCheckParts(admin, userId, level)).find((p) => p.part === part);
  if (!state) throw new Error("This part isn't at your level.");
  if (state.passed || state.lockedUntil) throw new Error("This part isn't open right now.");

  const questions: CheckQuestion[] = [];
  const key: { answer: number; group: string }[] = [];
  const add = (item: Item, pool: Item[], text: (i: Item) => string, q: Partial<CheckQuestion> & { prompt: string }, group: string, sub?: (i: Item) => string) => {
    const opts = shuffle([item, ...distractors(item, pool, 3, text)]);
    questions.push({ ...q, options: opts.map((o, n) => ({ id: String(n), label: text(o), sub: sub?.(o) })) });
    key.push({ answer: opts.indexOf(item), group });
  };
  if (part === "words") {
    const own = wordsAt(level);
    const earlier = wordsBelow(level);
    const newOnes = sample(own, earlier.length >= 25 ? 25 : 50);
    const oldOnes = earlier.length >= 25 ? sample(earlier, 25) : [];
    for (const w of shuffle([...newOnes, ...oldOnes])) {
      add(w, w.l === level ? own : earlier, (i) => i.g, { prompt: w.e }, w.l === level ? "new" : "old", (i) => i.r);
    }
  } else if (level === 0) {
    const pool = poolFor(0, "listening");
    for (let n = 0; n < 20; n++) {
      const q = soundQuestion(pool[n % pool.length], pool);
      questions.push({ prompt: "Which sound did you hear?", audioKey: q.audioKey, options: q.options! });
      key.push({ answer: q.options!.findIndex((o) => o.id === q.answerId), group: "new" });
    }
    questions.forEach((q) => { q.options = q.options.map((o, i) => ({ ...o, id: String(i) })); });
  } else {
    const pool = sentencesAt(level);
    for (const s of sample(pool, 10)) {
      add(s, pool, (i) => i.e, { prompt: "What did you hear?", audioKey: s.id }, "new");
    }
  }
  const { data, error } = await admin
    .from("practise_level_checks")
    .insert({ user_id: userId, level, part, answer_key: key, total: key.length })
    .select("id")
    .single();
  if (error) throw error;
  return { checkId: data.id as string, questions };
}

export async function submitLevelCheck(checkId: string, picks: string[]): Promise<CheckResult> {
  const { userId, level } = await requireLearner();
  const admin = createServiceRoleClient();
  const { data: row, error } = await admin
    .from("practise_level_checks")
    .select("part, answer_key, total, finished_at")
    .eq("id", checkId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!row || row.finished_at) throw new Error("This check has finished.");
  const key = row.answer_key as { answer: number; group: string }[];
  const right = key.map((k, i) => Number(picks[i]) === k.answer);
  const score = right.filter(Boolean).length;
  const groupOk = (g: string) => {
    const n = key.filter((k) => k.group === g).length;
    return n === 0 || n === key.length || key.filter((k, i) => k.group === g && right[i]).length >= 20;
  };
  const target = row.part === "words" ? 40 : level === 0 ? 16 : 8;
  const passed = score >= target && (row.part !== "words" || (groupOk("new") && groupOk("old")));
  await admin
    .from("practise_level_checks")
    .update({ score, passed, finished_at: new Date().toISOString() })
    .eq("id", checkId);
  const days = await cooldownDays(admin);
  revalidatePath("/dashboard/home");
  return {
    passed,
    score,
    total: row.total as number,
    message: passed
      ? "Part passed. It stays passed."
      : `This part opens again in ${days} days, with different questions. Everything else you have earned stays.`,
  };
}

