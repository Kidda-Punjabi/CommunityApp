import {
  PUNJABI_LESSON_TTS_MODEL_ID,
  PUNJABI_LESSON_VOICE_ID,
} from "@/lib/elevenlabs/constants";

export function getElevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key?.trim()) {
    throw new Error("ELEVENLABS_API_KEY is not set.");
  }
  return key.trim();
}

type SynthesizeSpeechOptions = {
  text: string;
  voiceId?: string;
  modelId?: string;
};

/**
 * Calls ElevenLabs Text-to-Speech and returns MP3 bytes. Server-only — never call from the client.
 */
export async function synthesizeSpeech({
  text,
  voiceId = PUNJABI_LESSON_VOICE_ID,
  modelId = PUNJABI_LESSON_TTS_MODEL_ID,
}: SynthesizeSpeechOptions): Promise<ArrayBuffer> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot synthesize empty text.");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": getElevenLabsApiKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const statusHint =
      response.status === 429
        ? "Rate limit or usage cap reached."
        : response.status === 401
          ? "Invalid API key."
          : `HTTP ${response.status}`;
    throw new Error(
      `ElevenLabs TTS failed (${statusHint})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }

  return response.arrayBuffer();
}
