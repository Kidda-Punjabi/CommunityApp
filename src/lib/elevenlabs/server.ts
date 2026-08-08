import {
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_VOICE_SETTINGS,
  ENGLISH_LESSON_TTS_MODEL_ID,
  ENGLISH_VOICE_SETTINGS,
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
  outputFormat?: string;
  voiceSettings?: Partial<{
    stability: number;
    similarity_boost: number;
    style: number;
    speed: number;
    use_speaker_boost: boolean;
  }>;
  /** Prefer clearer English settings (multilingual v2 + speaker boost). */
  clarityProfile?: "default" | "english_exam";
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
  modelId,
  outputFormat,
  voiceSettings,
  clarityProfile = "default",
  pronunciationDictionaryLocators,
  seed,
}: SynthesizeSpeechOptions): Promise<SynthesizeSpeechResult> {
  const resolvedVoiceId = resolveSpeechVoiceId(voiceId);
  const { normalized, issues } = normalizeScriptText(text);

  if (!normalized) {
    throw new Error("Cannot synthesize empty text.");
  }

  const useEnglishExamClarity = clarityProfile === "english_exam";

  const resolvedModelId =
    modelId ??
    (useEnglishExamClarity
      ? ENGLISH_LESSON_TTS_MODEL_ID
      : PUNJABI_LESSON_TTS_MODEL_ID);

  const resolvedFormat = outputFormat ?? DEFAULT_OUTPUT_FORMAT;

  const baseSettings = useEnglishExamClarity
    ? ENGLISH_VOICE_SETTINGS
    : DEFAULT_VOICE_SETTINGS;

  const mergedSettings = {
    ...baseSettings,
    ...voiceSettings,
  };

  // Speaker boost is not supported on eleven_v3.
  const settingsForApi =
    resolvedModelId === PUNJABI_LESSON_TTS_MODEL_ID
      ? {
          stability: mergedSettings.stability,
          similarity_boost: mergedSettings.similarity_boost,
          style: mergedSettings.style,
          speed: mergedSettings.speed,
        }
      : mergedSettings;

  const params = new URLSearchParams({
    output_format: resolvedFormat,
  });

  const body: Record<string, unknown> = {
    text: normalized,
    model_id: resolvedModelId,
    voice_settings: settingsForApi,
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
