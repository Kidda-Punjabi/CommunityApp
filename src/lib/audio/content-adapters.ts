import { slugifyCourseName } from "@/lib/lessons/slugify-course-name";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioContentType } from "@/lib/audio/types";
import {
  CONVERSATION_EXCHANGE_AUDIO_TYPES,
  type ConversationExchangeAudioSlot,
} from "@/lib/conversation/exchange-audio-types";

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

/** Prefer Gurmukhi for TTS — lesson cards use Gurmukhi front; dictionary uses Gurmukhi back. */
function defaultFlashcardScript(
  frontText: string | null | undefined,
  backText: string | null | undefined,
  romanised: string | null | undefined
): string {
  const front = frontText?.trim() ?? "";
  const back = backText?.trim() ?? "";
  const gurmukhi = /[\u0A00-\u0A7F]/;

  if (gurmukhi.test(front)) return front;
  if (gurmukhi.test(back)) return back;
  return romanised?.trim() || back || front || "Flashcard phrase";
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

type ExchangeRow = {
  id: string;
  scenario_id: string;
  sequence_order: number;
  npc_setup_gurmukhi: string;
  npc_reply_gurmukhi: string | null;
  target_response_gurmukhi: string;
  conversation_scenarios:
    | { title: string }
    | { title: string }[]
    | null;
};

const EXCHANGE_SLOT_LABELS: Record<ConversationExchangeAudioSlot, string> = {
  npc_setup: "NPC setup",
  npc_reply: "NPC reply",
  player_response: "Player response",
};

function exchangeScriptForSlot(row: ExchangeRow, slot: ConversationExchangeAudioSlot): string {
  switch (slot) {
    case "npc_setup":
      return row.npc_setup_gurmukhi.trim();
    case "npc_reply":
      return (row.npc_reply_gurmukhi ?? "").trim();
    case "player_response":
      return row.target_response_gurmukhi.trim();
  }
}

function createConversationExchangeAdapter(
  slot: ConversationExchangeAudioSlot
): AudioContentAdapter {
  const contentType = CONVERSATION_EXCHANGE_AUDIO_TYPES[slot];
  const slotLabel = EXCHANGE_SLOT_LABELS[slot];

  return {
    contentType,
    label: `Conversation — ${slotLabel}`,
    async loadContext(supabase, contentId) {
      const { data, error } = await supabase
        .from("conversation_exchanges")
        .select(
          "id, scenario_id, sequence_order, npc_setup_gurmukhi, npc_reply_gurmukhi, target_response_gurmukhi, conversation_scenarios(title)"
        )
        .eq("id", contentId)
        .single();

      if (error || !data) return null;

      const row = data as ExchangeRow;
      const scenario = Array.isArray(row.conversation_scenarios)
        ? row.conversation_scenarios[0]
        : row.conversation_scenarios;
      const defaultScript = exchangeScriptForSlot(row, slot);
      if (!defaultScript && slot !== "npc_reply") return null;
      if (slot === "npc_reply" && !defaultScript) return null;

      return {
        contentType,
        contentId: row.id,
        title: scenario?.title ?? "Conversation script",
        subtitle: `Exchange ${row.sequence_order} · ${slotLabel}`,
        defaultScript,
        scriptId: row.scenario_id,
        sequenceOrder: row.sequence_order,
      };
    },
    storagePath(context) {
      return `${context.scriptId}/${slot}/${context.contentId}.mp3`;
    },
    async syncOnGenerate() {
      // Exchange audio lives only in audio_assets — no column on conversation_exchanges.
    },
    async syncOnApprove() {
      // Learner reads approved URLs from audio_assets.
    },
    async syncOnReject() {
      // Previous approved clip remains until a new one is approved.
    },
    async syncScriptOnly() {
      // Script text is owned by conversation_exchanges, not edited via audio panel.
    },
  };
}

const conversationExchangeNpcSetupAdapter = createConversationExchangeAdapter("npc_setup");
const conversationExchangeNpcReplyAdapter = createConversationExchangeAdapter("npc_reply");
const conversationExchangePlayerResponseAdapter =
  createConversationExchangeAdapter("player_response");

const lessonSegmentBeatAdapter: AudioContentAdapter = {
  contentType: "lesson_segment_beat",
  label: "Catch-up beat",
  async loadContext(supabase, contentId) {
    const { data, error } = await supabase
      .from("lesson_segment_beats")
      .select("id, beat_number, script_text, segment_id")
      .eq("id", contentId)
      .single();

    if (error || !data) return null;

    const { data: segment } = await supabase
      .from("lesson_segments")
      .select("title, segment_number, lesson_id")
      .eq("id", data.segment_id)
      .maybeSingle();

    let courseName = "course";
    let lessonNumber: number | null = null;
    if (segment?.lesson_id) {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("lesson_number, courses(name)")
        .eq("id", segment.lesson_id)
        .maybeSingle();
      lessonNumber = lesson?.lesson_number ?? null;
      courseName = courseNameFromRelation(lesson?.courses ?? null);
    }

    return {
      contentType: "lesson_segment_beat",
      contentId: data.id,
      title: segment?.title ?? "Catch-up segment",
      subtitle: `${courseName} · L${lessonNumber ?? "?"} · Beat ${data.beat_number}`,
      defaultScript: data.script_text?.trim() || segment?.title || "Narration",
      courseName,
    };
  },
  storagePath(context) {
    return `catchup-beats/${context.contentId}.mp3`;
  },
  async syncOnGenerate() {},
  async syncOnApprove() {},
  async syncOnReject() {},
  async syncScriptOnly(supabase, context, scriptText) {
    await supabase
      .from("lesson_segment_beats")
      .update({ script_text: scriptText })
      .eq("id", context.contentId);
  },
};

const flashcardAdapter: AudioContentAdapter = {
  contentType: "flashcard",
  label: "Flashcard",
  async loadContext(supabase, contentId) {
    const { data, error } = await supabase
      .from("flashcards")
      .select("id, front_text, back_text, romanised, deck_name")
      .eq("id", contentId)
      .single();

    if (error || !data) return null;

    const defaultScript = defaultFlashcardScript(
      data.front_text,
      data.back_text,
      data.romanised
    );
    return {
      contentType: "flashcard",
      contentId: data.id,
      title: data.front_text?.trim() || data.deck_name?.trim() || "Flashcard",
      subtitle: data.romanised?.trim() || data.back_text?.trim() || null,
      defaultScript,
    };
  },
  storagePath(context) {
    return `flashcards/${context.contentId}.mp3`;
  },
  async syncOnGenerate() {},
  async syncOnApprove() {},
  async syncOnReject() {},
  async syncScriptOnly() {},
};

const flashcardExampleAdapter: AudioContentAdapter = {
  contentType: "flashcard_example",
  label: "Flashcard example",
  async loadContext(supabase, contentId) {
    const { data, error } = await supabase
      .from("flashcards")
      .select(
        "id, front_text, example_sentence_gurmukhi, example_sentence_romanised, example_sentence_english"
      )
      .eq("id", contentId)
      .single();

    if (error || !data) return null;

    const defaultScript = data.example_sentence_gurmukhi?.trim();
    if (!defaultScript) return null;

    return {
      contentType: "flashcard_example",
      contentId: data.id,
      title: data.front_text?.trim() || "Example sentence",
      subtitle: data.example_sentence_english?.trim() || null,
      defaultScript,
    };
  },
  storagePath(context) {
    return `flashcards/${context.contentId}-example.mp3`;
  },
  async syncOnGenerate() {},
  async syncOnApprove() {},
  async syncOnReject() {},
  async syncScriptOnly() {},
};

export const AUDIO_CONTENT_ADAPTERS: Record<AudioContentType, AudioContentAdapter> = {
  lesson: lessonAdapter,
  lesson_segment_beat: lessonSegmentBeatAdapter,
  flashcard: flashcardAdapter,
  flashcard_example: flashcardExampleAdapter,
  comprehension_sentence: comprehensionSentenceAdapter,
  conversation_turn: conversationTurnAdapter,
  conversation_exchange_npc_setup: conversationExchangeNpcSetupAdapter,
  conversation_exchange_npc_reply: conversationExchangeNpcReplyAdapter,
  conversation_exchange_player_response: conversationExchangePlayerResponseAdapter,
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
