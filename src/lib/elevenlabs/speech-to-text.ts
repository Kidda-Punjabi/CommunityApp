import { getElevenLabsApiKey } from "@/lib/elevenlabs/server";

export const SCRIBE_MODEL_ID = "scribe_v2";

export type TranscribeSpeechOptions = {
  /** ISO 639-1 or 639-3 hint — Punjabi is `pan`. */
  languageCode?: string;
  /** Optional romanised target to bias transcription. */
  keyterms?: string[];
};

export type TranscribeSpeechResult = {
  text: string;
  languageCode: string | null;
};

/**
 * Batch speech-to-text via ElevenLabs Scribe.
 * Audio is sent in-memory only — callers must not persist the blob.
 */
export async function transcribeSpeech(
  audio: Blob,
  options: TranscribeSpeechOptions = {}
): Promise<TranscribeSpeechResult> {
  if (audio.size === 0) {
    throw new Error("Audio recording is empty.");
  }

  const form = new FormData();
  form.append("file", audio, "recording.webm");
  form.append("model_id", SCRIBE_MODEL_ID);

  if (options.languageCode) {
    form.append("language_code", options.languageCode);
  }

  if (options.keyterms?.length) {
    for (const term of options.keyterms.slice(0, 10)) {
      if (term.trim()) form.append("keyterms", term.trim());
    }
  }

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": getElevenLabsApiKey(),
    },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const statusHint =
      response.status === 429
        ? "Rate limit or usage cap reached."
        : response.status === 401
          ? "Invalid API key."
          : `HTTP ${response.status}`;
    throw new Error(
      `ElevenLabs STT failed (${statusHint})${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }

  const payload = (await response.json()) as {
    text?: string;
    language_code?: string;
  };

  const text = payload.text?.trim() ?? "";
  if (!text) {
    throw new Error("No speech detected — try speaking a little louder.");
  }

  return {
    text,
    languageCode: payload.language_code ?? null,
  };
}
