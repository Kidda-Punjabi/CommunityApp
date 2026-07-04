import { slugifyCourseName } from "@/lib/lessons/slugify-course-name";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioContentType } from "@/lib/audio/types";

export type AudioContentContext = {
  contentType: AudioContentType;
  contentId: string;
  title: string;
  subtitle: string | null;
  defaultScript: string;
  courseName?: string;
  scriptId?: string;
  sequenceOrder?: number;
};

export type AudioContentAdapter = {
  contentType: AudioContentType;
  label: string;
  loadContext: (
    supabase: SupabaseClient,
    contentId: string
  ) => Promise<AudioContentContext | null>;
  storagePath: (context: AudioContentContext) => string;
  syncOnGenerate: (
    supabase: SupabaseClient,
    context: AudioContentContext,
    scriptText: string,
    storagePath: string
  ) => Promise<void>;
  syncOnApprove: (
    supabase: SupabaseClient,
    context: AudioContentContext,
    publicUrl: string
  ) => Promise<void>;
  syncOnReject: (supabase: SupabaseClient, context: AudioContentContext) => Promise<void>;
  syncScriptOnly: (
    supabase: SupabaseClient,
    context: AudioContentContext,
    scriptText: string
  ) => Promise<void>;
};

function courseNameFromRelation(
  courses: { name: string } | { name: string }[] | null
): string {
  if (Array.isArray(courses)) return courses[0]?.name ?? "course";
  return courses?.name ?? "course";
}

const lessonAdapter: AudioContentAdapter = {
  contentType: "lesson",
  label: "Lesson",
  async loadContext(supabase, contentId) {
    const { data, error } = await supabase
      .from("lessons")
      .select("id, title, lesson_number, audio_script, courses(name)")
      .eq("id", contentId)
      .single();

    if (error || !data) return null;

    const courseName = courseNameFromRelation(data.courses);
    const defaultScript = data.audio_script?.trim() || data.title.trim();

    return {
      contentType: "lesson",
      contentId: data.id,
      title: data.title,
      subtitle: `${courseName} · Lesson ${data.lesson_number}`,
      defaultScript,
      courseName,
    };
  },
  storagePath(context) {
    return `${slugifyCourseName(context.courseName ?? "course")}/${context.contentId}.mp3`;
  },
  async syncOnGenerate(supabase, context, scriptText, storagePath) {
    await supabase
      .from("lessons")
      .update({
        audio_script: scriptText,
        generated_audio_status: "pending_review",
        pending_audio_path: storagePath,
      })
      .eq("id", context.contentId);
  },
  async syncOnApprove(supabase, context, publicUrl) {
    await supabase
      .from("lessons")
      .update({
        audio_url: publicUrl,
        generated_audio_status: "approved",
      })
      .eq("id", context.contentId);
  },
  async syncOnReject(supabase, context) {
    await supabase
      .from("lessons")
      .update({ generated_audio_status: "needs_changes" })
      .eq("id", context.contentId);
  },
  async syncScriptOnly(supabase, context, scriptText) {
    await supabase
      .from("lessons")
      .update({ audio_script: scriptText })
      .eq("id", context.contentId);
  },
};

const comprehensionSentenceAdapter: AudioContentAdapter = {
  contentType: "comprehension_sentence",
  label: "Comprehension Practice",
  async loadContext(supabase, contentId) {
    const { data, error } = await supabase
      .from("comprehension_sentences")
      .select(
        "id, script_id, sequence_order, gurmukhi_text, comprehension_scripts(title)"
      )
      .eq("id", contentId)
      .single();

    if (error || !data) return null;

    const script = Array.isArray(data.comprehension_scripts)
      ? data.comprehension_scripts[0]
      : data.comprehension_scripts;

    return {
      contentType: "comprehension_sentence",
      contentId: data.id,
      title: script?.title ?? "Comprehension script",
      subtitle: `Sentence ${data.sequence_order}`,
      defaultScript: data.gurmukhi_text.trim(),
      scriptId: data.script_id,
      sequenceOrder: data.sequence_order,
    };
  },
  storagePath(context) {
    return `${context.scriptId}/${context.contentId}.mp3`;
  },
  async syncOnGenerate(supabase, context, scriptText) {
    await supabase
      .from("comprehension_sentences")
      .update({ gurmukhi_text: scriptText })
      .eq("id", context.contentId);
  },
  async syncOnApprove(supabase, context, publicUrl) {
    await supabase
      .from("comprehension_sentences")
      .update({ audio_url: publicUrl })
      .eq("id", context.contentId);
  },
  async syncOnReject() {
    // Sentence keeps previous approved audio_url until a new clip is approved.
  },
  async syncScriptOnly(supabase, context, scriptText) {
    await supabase
      .from("comprehension_sentences")
      .update({ gurmukhi_text: scriptText })
      .eq("id", context.contentId);
  },
};

const conversationTurnAdapter: AudioContentAdapter = {
  contentType: "conversation_turn",
  label: "Conversation Practice",
  async loadContext(supabase, contentId) {
    const { data, error } = await supabase
      .from("conversation_turns")
      .select(
        "id, scenario_id, sequence_order, gurmukhi_text, conversation_scenarios(title), conversation_scenario_characters(name)"
      )
      .eq("id", contentId)
      .single();

    if (error || !data) return null;

    const scenario = Array.isArray(data.conversation_scenarios)
      ? data.conversation_scenarios[0]
      : data.conversation_scenarios;
    const character = Array.isArray(data.conversation_scenario_characters)
      ? data.conversation_scenario_characters[0]
      : data.conversation_scenario_characters;

    return {
      contentType: "conversation_turn",
      contentId: data.id,
      title: scenario?.title ?? "Conversation script",
      subtitle: `${character?.name ?? "Speaker"} · Turn ${data.sequence_order}`,
      defaultScript: data.gurmukhi_text.trim(),
      scriptId: data.scenario_id,
      sequenceOrder: data.sequence_order,
    };
  },
  storagePath(context) {
    return `${context.scriptId}/${context.contentId}.mp3`;
  },
  async syncOnGenerate(supabase, context, scriptText) {
    await supabase
      .from("conversation_turns")
      .update({ gurmukhi_text: scriptText })
      .eq("id", context.contentId);
  },
  async syncOnApprove(supabase, context, publicUrl) {
    await supabase
      .from("conversation_turns")
      .update({ audio_url: publicUrl })
      .eq("id", context.contentId);
  },
  async syncOnReject() {
    // Turn keeps previous approved audio_url until a new clip is approved.
  },
  async syncScriptOnly(supabase, context, scriptText) {
    await supabase
      .from("conversation_turns")
      .update({ gurmukhi_text: scriptText })
      .eq("id", context.contentId);
  },
};

export const AUDIO_CONTENT_ADAPTERS: Record<AudioContentType, AudioContentAdapter> = {
  lesson: lessonAdapter,
  comprehension_sentence: comprehensionSentenceAdapter,
  conversation_turn: conversationTurnAdapter,
};

export function getAudioContentAdapter(contentType: AudioContentType): AudioContentAdapter {
  return AUDIO_CONTENT_ADAPTERS[contentType];
}

export function formatAudioReviewTitle(context: AudioContentContext): string {
  if (context.subtitle) {
    return `${context.subtitle}: ${context.title}`;
  }
  return context.title;
}
