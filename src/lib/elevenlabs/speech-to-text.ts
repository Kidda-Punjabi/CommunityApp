import { getElevenLabsApiKey } from "@/lib/elevenlabs/server";

export const SCRIBE_MODEL_ID = "scribe_v2";

/** ElevenLabs rejects keyterms with more than 4 spaces (~5 words). */
export const SCRIBE_KEYTERM_MAX_SPACES = 4;
export const SCRIBE_KEYTERM_MAX_COUNT = 100;

export type TranscribeSpeechOptions = {
  /** ISO 639-1 or 639-3 hint — Punjabi is `pan`. */
  languageCode?: string;
  /** Optional romanised / Gurmukhi phrases to bias transcription. */
  keyterms?: string[];
};

export type TranscribeSpeechResult = {
  text: string;
  languageCode: string | null;
  /** Scribe confidence for detected language (0–1), when auto-detect is used. */
  languageProbability: number | null;
};

/**
 * Split / trim keyterms so each entry stays within ElevenLabs' 4-space limit.
 * Longer target sentences are chunked into ≤5-word phrases instead of failing the request.
 */
export function sanitizeScribeKeyterms(terms: string[] | undefined): string[] {
  if (!terms?.length) return [];

  const maxWords = SCRIBE_KEYTERM_MAX_SPACES + 1;
  const out: string[] = [];

  for (const raw of terms) {
    const cleaned = raw.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;

    const words = cleaned.split(" ");
    if (words.length <= maxWords) {
      out.push(cleaned);
      continue;
    }

    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords).join(" ").trim();
      if (chunk) out.push(chunk);
    }
  }

  return [...new Set(out)].slice(0, SCRIBE_KEYTERM_MAX_COUNT);
}

function parseTranscribePayload(payload: {
  text?: string;
  language_code?: string;
  language_probability?: number;
}): TranscribeSpeechResult {
  const text = payload.text?.trim() ?? "";
  if (!text) {
    throw new Error("No speech detected — try speaking a little louder.");
  }

  const prob = payload.language_probability;
  const languageProbability =
    typeof prob === "number" && Number.isFinite(prob) ? prob : null;

  return {
    text,
    languageCode: payload.language_code ?? null,
    languageProbability,
  };
}

async function requestScribeTranscription(
  audio: Blob,
  options: TranscribeSpeechOptions,
  keyterms: string[]
): Promise<Response> {
  const form = new FormData();
  form.append("file", audio, "recording.webm");
  form.append("model_id", SCRIBE_MODEL_ID);

  if (options.languageCode) {
    form.append("language_code", options.languageCode);
  }

  for (const term of keyterms) {
    form.append("keyterms", term);
  }

  return fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": getElevenLabsApiKey(),
    },
    body: form,
  });
}

function isKeytermValidationError(status: number, detail: string): boolean {
  if (status !== 400) return false;
  const lower = detail.toLowerCase();
  return (
    lower.includes("keyterm") ||
    lower.includes("keyword") ||
    (lower.includes("validation_error") && lower.includes("space"))
  );
}

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

  const keyterms = sanitizeScribeKeyterms(options.keyterms);
  let response = await requestScribeTranscription(audio, options, keyterms);

  // If keyterm biasing still fails validation, fall back to plain transcription.
  if (!response.ok && keyterms.length > 0) {
    const detail = await response.text().catch(() => "");
    if (isKeytermValidationError(response.status, detail)) {
      response = await requestScribeTranscription(audio, options, []);
    } else {
      throwScribeHttpError(response.status, detail);
    }
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throwScribeHttpError(response.status, detail);
  }

  const payload = (await response.json()) as {
    text?: string;
    language_code?: string;
    language_probability?: number;
  };

  return parseTranscribePayload(payload);
}

function throwScribeHttpError(status: number, detail: string): never {
  const statusHint =
    status === 429
      ? "Rate limit or usage cap reached."
      : status === 401
        ? "Invalid API key."
        : `HTTP ${status}`;
  throw new Error(
    `ElevenLabs STT failed (${statusHint})${detail ? `: ${detail.slice(0, 300)}` : ""}`
  );
}

/** User-facing copy — never forward raw ElevenLabs JSON to the client. */
export function userFacingSpeechToTextError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (!message) return "Could not transcribe your recording. Please try again.";

  if (message.includes("No speech detected")) return message;
  if (message.includes("Audio recording is empty")) {
    return "No audio was captured — hold a moment longer, then try again.";
  }
  if (message.includes("Rate limit") || message.includes("429")) {
    return "Speech recognition is busy right now. Please try again in a moment.";
  }
  if (
    message.includes("validation_error") ||
    message.includes("invalid_parameters") ||
    message.includes("keyterm") ||
    message.includes("keyword")
  ) {
    return "Could not process that recording. Please try again.";
  }
  if (message.includes("ElevenLabs STT failed")) {
    return "Could not transcribe your recording. Please try again.";
  }

  return "Could not transcribe your recording. Please try again.";
}
