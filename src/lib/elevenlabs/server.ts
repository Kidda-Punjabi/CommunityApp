import {
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_VOICE_SETTINGS,
  PUNJABI_LESSON_TTS_MODEL_ID,
  PUNJABI_LESSON_VOICE_ID,
  resolveSpeechVoiceId,
} from "@/lib/elevenlabs/constants";
import { normalizeScriptText } from "@/lib/elevenlabs/normalize-script";

export function getElevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key?.trim()) {
    throw new Error("ELEVENLABS_API_KEY is not set.");
  }
  return key.trim();
}

export type PronunciationDictionaryLocator = {
  pronunciation_dictionary_id: string;
  version_id?: string | null;
};

export type SynthesizeSpeechOptions = {
  text: string;
  voiceId?: string;
  modelId?: string;
  pronunciationDictionaryLocators?: PronunciationDictionaryLocator[];
  seed?: number;
};

export type SynthesizeSpeechResult = {
  audio: ArrayBuffer;
  normalizedText: string;
  normalizationIssues: string[];
};

/**
 * Calls ElevenLabs Text-to-Speech aligned with dashboard defaults:
 * - model: eleven_v3 (not eleven_multilingual_v2)
 * - voice_settings: stability 0.5, similarity 0.75, style 0.0 (no speaker_boost on v3)
 * - output_format: mp3_44100_128
 * - apply_text_normalization: auto
 *
 * Dashboard "Enhance" is UI-only (LLM audio-tag insertion) — not sent via API; lesson scripts
 * should not use Enhance unless tags are added manually to the script text.
 */
export async function synthesizeSpeech({
  text,
  voiceId = PUNJABI_LESSON_VOICE_ID,
  modelId = PUNJABI_LESSON_TTS_MODEL_ID,
  pronunciationDictionaryLocators,
  seed,
}: SynthesizeSpeechOptions): Promise<SynthesizeSpeechResult> {
  const resolvedVoiceId = resolveSpeechVoiceId(voiceId);
  const { normalized, issues } = normalizeScriptText(text);

  if (!normalized) {
    throw new Error("Cannot synthesize empty text.");
  }

  const params = new URLSearchParams({
    output_format: DEFAULT_OUTPUT_FORMAT,
  });

  const body: Record<string, unknown> = {
    text: normalized,
    model_id: modelId,
    voice_settings: {
      stability: DEFAULT_VOICE_SETTINGS.stability,
      similarity_boost: DEFAULT_VOICE_SETTINGS.similarity_boost,
      style: DEFAULT_VOICE_SETTINGS.style,
      speed: DEFAULT_VOICE_SETTINGS.speed,
    },
    apply_text_normalization: "auto",
  };

  if (pronunciationDictionaryLocators?.length) {
    body.pronunciation_dictionary_locators = pronunciationDictionaryLocators.map((locator) => ({
      pronunciation_dictionary_id: locator.pronunciation_dictionary_id,
      version_id: locator.version_id ?? null,
    }));
  }

  if (seed != null) {
    body.seed = seed;
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(resolvedVoiceId)}?${params}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": getElevenLabsApiKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const statusHint =
      response.status === 429
        ? "Rate limit or usage cap reached."
        : response.status === 401
          ? "Invalid API key."
          : response.status === 402
            ? "Account/plan restriction (e.g. library voice on free tier)."
            : `HTTP ${response.status}`;
    throw new Error(
      `ElevenLabs TTS failed (${statusHint})${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }

  return {
    audio: await response.arrayBuffer(),
    normalizedText: normalized,
    normalizationIssues: issues,
  };
}
