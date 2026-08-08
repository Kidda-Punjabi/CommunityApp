/** Primary Punjabi lesson voice — ElevenLabs voice ID. */
export const PUNJABI_LESSON_VOICE_ID = "ttyKbP9zTIRyRCN6b2Ye";

/**
 * English lesson / Life-in-the-UK sentence voice — ElevenLabs Adam (premade).
 * Used for English Foundations and bilingual exam materials.
 */
export const ENGLISH_LESSON_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

/**
 * Learner / player voice for Conversation Practice — distinct from NPC voices.
 * Noor: young female Punjabi (Doaba accent). Vetted for player-response clips only.
 */
export const PUNJABI_CONVERSATION_PLAYER_VOICE_ID = "vT0wMbLG5dssaBsksrb6";

/**
 * Eleven v3 — matches the ElevenLabs dashboard default for expressive multilingual TTS.
 * Required for phoneme pronunciation dictionary rules on non-English text.
 * (Pipeline previously used eleven_multilingual_v2, which differs materially from dashboard v3.)
 */
export const PUNJABI_LESSON_TTS_MODEL_ID = "eleven_v3";

export type VettedVoice = {
  id: string;
  label: string;
  description?: string;
};

/** Vetted voices selectable in admin — extend this list as new voices are approved. */
export const VETTED_PUNJABI_VOICES: VettedVoice[] = [
  {
    id: PUNJABI_LESSON_VOICE_ID,
    label: "Yatin — Punjabi Customer Support",
    description: "Primary voice used for lesson, comprehension, and NPC conversation lines.",
  },
  {
    id: PUNJABI_CONVERSATION_PLAYER_VOICE_ID,
    label: "Noor — Punjabi (learner)",
    description:
      "Young female Punjabi voice for conversation player-response clips — distinct from NPC speakers.",
  },
];

export const DEFAULT_VETTED_VOICE_ID = PUNJABI_LESSON_VOICE_ID;

export function getVettedVoice(voiceId: string): VettedVoice | undefined {
  return VETTED_PUNJABI_VOICES.find((voice) => voice.id === voiceId);
}

export function resolveVettedVoiceId(voiceId?: string | null): string {
  if (voiceId && getVettedVoice(voiceId)) return voiceId;
  return DEFAULT_VETTED_VOICE_ID;
}

/**
 * Resolve TTS voice for synthesis. Allows vetted Punjabi voices and the
 * approved English Adam voice without remapping Adam → Yatin.
 */
export function resolveSpeechVoiceId(voiceId?: string | null): string {
  if (voiceId === ENGLISH_LESSON_VOICE_ID) return ENGLISH_LESSON_VOICE_ID;
  return resolveVettedVoiceId(voiceId);
}

/**
 * Dashboard-aligned voice settings for eleven_v3.
 * Note: use_speaker_boost is not supported on v3 (dashboard disables it for v3).
 */
export const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  speed: 1.0,
} as const;

/**
 * English exam / theory-question TTS — multilingual v2 + speaker boost.
 * Clearer and less "muffled" than Adam on eleven_v3 for short MCQ prompts.
 */
export const ENGLISH_LESSON_TTS_MODEL_ID = "eleven_multilingual_v2";

export const ENGLISH_VOICE_SETTINGS = {
  stability: 0.45,
  similarity_boost: 0.85,
  style: 0.0,
  speed: 0.92,
  use_speaker_boost: true,
} as const;

/** Default MP3 output — matches dashboard mp3_44100_128. */
export const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
