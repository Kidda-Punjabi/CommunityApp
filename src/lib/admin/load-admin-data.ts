import { ensureDefaultCourses } from "@/lib/courses/ensure-default-courses";
import { loadSiteBranding } from "@/lib/branding/load-site-branding";
import { ensureStorageBuckets } from "@/lib/supabase/ensure-storage-buckets";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { loadAdminTutorPanelData } from "@/app/admin/content/tutor-actions";
import type { AdminData } from "@/app/admin/content/types";
import type { SiteBranding } from "@/lib/branding/types";
import { EMPTY_ADMIN_DATA } from "@/lib/admin/empty-admin-data";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminLoadResult =
  | { ok: true; data: AdminData; branding: SiteBranding }
  | { ok: false; error: string };

function getAdminClient():
  | { ok: true; client: SupabaseClient }
  | { ok: false; error: string } {
  const service = tryCreateServiceRoleClient();
  if (service.error || !service.client) {
    return { ok: false, error: service.error ?? "Supabase admin client unavailable." };
  }
  return { ok: true, client: service.client };
}

async function loadTutorPanelSlice() {
  return loadAdminTutorPanelData().catch((e) => ({
    enrollments: [] as AdminData["enrollments"],
    cohorts: [] as AdminData["cohorts"],
    staffMembers: [] as AdminData["staffMembers"],
    errors: {
      enrollments: undefined,
      cohorts: undefined,
      staffMembers:
        e instanceof Error ? e.message : "Failed to load staff and tutor data.",
    },
  }));
}

/** People / home / packages tabs — staff, cohorts, enrollments only. */
export async function loadAdminCoreData(): Promise<AdminLoadResult> {
  const clientResult = getAdminClient();
  if (!clientResult.ok) {
    return { ok: false, error: clientResult.error };
  }

  const [tutorPanel, branding] = await Promise.all([
    loadTutorPanelSlice(),
    loadSiteBranding(),
  ]);

  const data: AdminData = {
    ...EMPTY_ADMIN_DATA,
    enrollments: tutorPanel.enrollments,
    cohorts: tutorPanel.cohorts,
    staffMembers: tutorPanel.staffMembers,
    errors: {
      enrollments: tutorPanel.errors.enrollments,
      cohorts: tutorPanel.errors.cohorts,
      staffMembers: tutorPanel.errors.staffMembers,
    },
  };

  return { ok: true, data, branding };
}

/** Curriculum + games tabs — courses, lessons, quizzes, flashcards, etc. */
export async function loadAdminCurriculumData(): Promise<AdminLoadResult> {
  const clientResult = getAdminClient();
  if (!clientResult.ok) {
    return { ok: false, error: clientResult.error };
  }

  const supabase = clientResult.client;

  try {
    await Promise.all([
      ensureDefaultCourses(supabase),
      ensureStorageBuckets(supabase),
    ]);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to prepare admin environment.",
    };
  }

  const [
    { data: courses, error: coursesError },
    { data: lessons, error: lessonsError },
    { data: quizzes, error: quizzesError },
    { data: questions, error: questionsError },
    { data: flashcardSets, error: flashcardSetsError },
    { data: setCourseLinks, error: setCourseLinksError },
    { data: flashcards, error: flashcardsError },
    { data: grammarSentences, error: grammarSentencesError },
    { data: verbConjugations, error: verbConjugationsError },
    { data: genderedNouns, error: genderedNounsError },
  ] = await Promise.all([
    supabase.from("courses").select("id, name, description, display_order, required_tier").order("display_order"),
    supabase
      .from("lessons")
      .select("*, courses(name)")
      .order("course_id")
      .order("lesson_number"),
    supabase
      .from("quizzes")
      .select("*, courses(name)")
      .order("course_id")
      .order("level_number"),
    supabase
      .from("quiz_questions")
      .select("*")
      .order("quiz_id")
      .order("question_order"),
    supabase.from("flashcard_sets").select("*").order("name"),
    supabase.from("set_course_links").select("*"),
    supabase.from("flashcards").select("*").order("deck_id").order("created_at"),
    supabase.from("grammar_sentences").select("*").order("created_at", { ascending: false }),
    supabase.from("verb_conjugations").select("*").order("verb_root"),
    supabase.from("gendered_nouns").select("*").order("punjabi_word"),
  ]);

  const data: AdminData = {
    ...EMPTY_ADMIN_DATA,
    courses: courses ?? [],
    lessons: (lessons ?? []) as AdminData["lessons"],
    quizzes: (quizzes ?? []) as AdminData["quizzes"],
    questions: questions ?? [],
    flashcardSets: flashcardSets ?? [],
    setCourseLinks: setCourseLinks ?? [],
    flashcards: (flashcards ?? []) as AdminData["flashcards"],
    grammarSentences: (grammarSentences ?? []) as AdminData["grammarSentences"],
    verbConjugations: (verbConjugations ?? []) as AdminData["verbConjugations"],
    genderedNouns: (genderedNouns ?? []) as AdminData["genderedNouns"],
    errors: {
      courses: coursesError?.message,
      lessons: lessonsError?.message,
      quizzes: quizzesError?.message,
      questions: questionsError?.message,
      flashcardSets: flashcardSetsError?.message,
      setCourseLinks: setCourseLinksError?.message,
      flashcards: flashcardsError?.message,
      grammarSentences: grammarSentencesError?.message,
      verbConjugations: verbConjugationsError?.message,
      genderedNouns: genderedNounsError?.message,
    },
  };

  const branding = await loadSiteBranding();
  return { ok: true, data, branding };
}

/** Site tab — events only. */
export async function loadAdminSiteData(): Promise<AdminLoadResult> {
  const clientResult = getAdminClient();
  if (!clientResult.ok) {
    return { ok: false, error: clientResult.error };
  }

  const { data: events, error: eventsError } = await clientResult.client
    .from("events")
    .select("*")
    .order("starts_at", { ascending: false });

  const data: AdminData = {
    ...EMPTY_ADMIN_DATA,
    events: events ?? [],
    errors: {
      events: eventsError?.message,
    },
  };

  const branding = await loadSiteBranding();
  return { ok: true, data, branding };
}

/** Full load — kept for scripts or one-shot use. */
export async function loadAdminData(): Promise<AdminLoadResult> {
  const [core, curriculum, site] = await Promise.all([
    loadAdminCoreData(),
    loadAdminCurriculumData(),
    loadAdminSiteData(),
  ]);

  if (!core.ok) return core;
  if (!curriculum.ok) return curriculum;
  if (!site.ok) return site;

  const data: AdminData = {
    ...curriculum.data,
    enrollments: core.data.enrollments,
    cohorts: core.data.cohorts,
    staffMembers: core.data.staffMembers,
    events: site.data.events,
    errors: {
      ...curriculum.data.errors,
      ...core.data.errors,
      ...site.data.errors,
    },
  };

  return { ok: true, data, branding: core.branding };
}
