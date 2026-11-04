import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanTopic, isItemDone, poolFor, rulesAt, skillsForLevel } from "./content";
import { ITEM_DONE_AT, LEVELS, RULE_CORRECT_PER_STAR } from "./levels";
import type { CheckPartState, ChecklistRow, PractiseHome, PractiseSkill, SkillSummary } from "./types";

const PASS: Record<PractiseSkill, string> = {
  words: "Word check: 40 of 50",
  grammar: "Checked inside the speaking test",
  listening: "Listening test: 8 of 10",
  speaking: "Speaking test with your tutor: 3.5 average",
};

export function skillLabel(level: number, skill: PractiseSkill) {
  if (level === 0 && skill === "listening") return "Hearing";
  if (level === 0 && skill === "speaking") return "Saying";
  return { words: "Words", grammar: "Grammar", listening: "Listening", speaking: "Speaking" }[skill];
}

export async function loadProgress(supabase: SupabaseClient, userId: string) {
  const map = new Map<string, number>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("practise_progress")
      .select("item_id, skill, correct_count")
      .eq("user_id", userId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const r of data ?? []) map.set(`${r.skill}:${r.item_id}`, r.correct_count as number);
    if ((data ?? []).length < pageSize) break;
  }
  return map;
}

export function summariseSkill(level: number, skill: PractiseSkill, progress: Map<string, number>): SkillSummary {
  const pool = poolFor(level, skill);
  const count = (id: string) => progress.get(`${skill}:${id}`) ?? 0;
  const done = pool.filter((i) => isItemDone(skill, count(i.id))).length;
  const practised = pool.filter((i) => count(i.id) > 0).length;
  const threshold = skill === "grammar" ? RULE_CORRECT_PER_STAR * 3 : ITEM_DONE_AT;
  const credit = pool.reduce((sum, i) => sum + Math.min(count(i.id), threshold), 0);
  const rawCredit = pool.length ? Math.round((credit / (pool.length * threshold)) * 100) : 0;
  let rows: ChecklistRow[];
  if (skill === "grammar") {
    rows = rulesAt(level).map((r) => {
      const stars = Math.min(3, Math.floor(count(r.id) / RULE_CORRECT_PER_STAR));
      return { label: r.e, done: stars === 3 ? 1 : 0, total: 1, practised: count(r.id), stars };
    });
  } else {
    const groups = new Map<string, ChecklistRow>();
    for (const i of pool) {
      const label = level === 9 ? `Level ${i.l}` : cleanTopic(i.t);
      const row = groups.get(label) ?? { label, done: 0, total: 0, practised: 0 };
      row.total += 1;
      if (count(i.id) > 0) row.practised += 1;
      if (isItemDone(skill, count(i.id))) row.done += 1;
      groups.set(label, row);
    }
    rows = [...groups.values()];
  }
  const next = rows.find((r) => r.done < r.total);
  const unit = skill === "words" ? "words" : skill === "grammar" ? "rules" : level === 0 ? "sounds" : "sentences";
  const passLabel =
    level === 0 ? (skill === "listening" ? "20 sound checks" : "Voice note to your tutor")
    : level === 9 ? (skill === "listening" ? "Real Punjabi, unseen" : "10 minutes unprepared")
    : PASS[skill];
  return {
    skill,
    label: skillLabel(level, skill),
    pct: pool.length ? Math.round((done / pool.length) * 100) : 0,
    creditPct: credit > 0 ? Math.max(1, rawCredit) : 0,
    practised,
    done,
    total: pool.length,
    unit,
    passLabel,
    focus: next?.label ?? "Keep it sharp",
    rows,
  };
}

export async function cooldownDays(admin: SupabaseClient): Promise<number> {
  const { data } = await admin.from("community_level_settings").select("retake_cooldown_days").limit(1).maybeSingle();
  return Number(data?.retake_cooldown_days ?? 28);
}

export async function loadCheckParts(admin: SupabaseClient, userId: string, level: number): Promise<CheckPartState[]> {
  if (level === 9) return [];
  const days = await cooldownDays(admin);
  const defs: Omit<CheckPartState, "passed" | "lastScore" | "lockedUntil">[] =
    level === 0
      ? [{ part: "listening", label: "Sound check", detail: "Audio only. Hear a sound and say which one it was.", passLabel: "Pass: 16 of 20" }]
      : [
          { part: "words", label: "Word check", detail: "50 words, English to Punjabi, about 5 minutes.", passLabel: level === 1 ? "Pass: 40 of 50" : "Pass: 40 of 50, at least 20 from each group" },
          { part: "listening", label: "Listening test", detail: "Audio only. 10 sentences, no words on screen.", passLabel: "Pass: 8 of 10" },
        ];
  const { data } = await admin
    .from("practise_level_checks")
    .select("part, score, total, passed, finished_at")
    .eq("user_id", userId)
    .eq("level", level)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false });
  return defs.map((d) => {
    const rows = (data ?? []).filter((r) => r.part === d.part);
    const passedRow = rows.find((r) => r.passed);
    const last = passedRow ?? rows[0];
    let lockedUntil: string | null = null;
    if (!passedRow && last?.finished_at) {
      const until = new Date(new Date(last.finished_at as string).getTime() + days * 86_400_000);
      if (until > new Date()) lockedUntil = until.toISOString();
    }
    return { ...d, passed: Boolean(passedRow), lastScore: last ? `${last.score} of ${last.total}` : null, lockedUntil };
  });
}

export async function loadPractiseHome(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  level: number
): Promise<PractiseHome> {
  const [progress, checkParts, state, rounds] = await Promise.all([
    loadProgress(supabase, userId),
    loadCheckParts(admin, userId, level),
    supabase.from("practise_state").select("seen_level").eq("user_id", userId).maybeSingle(),
    supabase
      .from("practise_rounds")
      .select("local_date")
      .eq("user_id", userId)
      .gte("local_date", new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  const skills = skillsForLevel(level).map((s) => summariseSkill(level, s, progress));
  const open = skills.filter((s) => s.pct < 100);
  const weakest = open.length ? [...open].sort((a, b) => a.pct - b.pct)[0].skill : null;
  const seen = state.data?.seen_level as number | null | undefined;
  if (seen == null || seen !== level) {
    await supabase.from("practise_state").upsert({ user_id: userId, seen_level: level, updated_at: new Date().toISOString() });
  }
  return {
    meta: LEVELS[level],
    skills,
    weakest,
    ready: open.length === 0,
    checkParts,
    levelUpFrom: seen != null && level > seen ? seen : null,
    playedDates: [...new Set((rounds.data ?? []).map((r) => r.local_date as string))],
  };
}
