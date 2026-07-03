/**
 * Simulates Safari's silent Punjabi recognition failure (start() never fires
 * onspeechstart/onresult). Run: npx tsx scripts/verify-punjabi-speech-timeout.ts
 */
import {
  PUNJABI_SPEECH_LANG_TAGS,
  PUNJABI_SPEECH_LISTEN_TIMEOUT_MS,
  SPEECH_PUNJABI_UNAVAILABLE_MESSAGE,
} from "../src/lib/speech/speech-recognition";

class SilentMockRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;

  start() {
    // Safari + pa-IN: no permission prompt, no events.
  }

  stop() {
    this.onend?.();
  }

  abort() {
    this.onerror?.({ error: "aborted" });
    this.onend?.();
  }
}

// @ts-expect-error Node test polyfill for getSpeechRecognitionConstructor()
(globalThis as typeof globalThis & { window?: typeof globalThis }).window = globalThis;
(globalThis as typeof globalThis & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
  SilentMockRecognition;

async function main() {
  const { startPunjabiRecognitionSession } = await import(
    "../src/lib/speech/punjabi-recognition-session"
  );

  const errors: string[] = [];
  let listening = false;

  startPunjabiRecognitionSession({
    onTranscript: () => errors.push("unexpected:transcript"),
    onError: (message) => errors.push(message),
    onListeningChange: (active) => {
      listening = active;
    },
  });

  await new Promise((resolve) =>
    setTimeout(
      resolve,
      PUNJABI_SPEECH_LISTEN_TIMEOUT_MS * PUNJABI_SPEECH_LANG_TAGS.length + 200
    )
  );

  if (!errors.includes(SPEECH_PUNJABI_UNAVAILABLE_MESSAGE)) {
    console.error("FAIL: expected timeout message, got:", errors);
    process.exit(1);
  }

  if (listening) {
    console.error("FAIL: still marked as listening after timeout");
    process.exit(1);
  }

  console.log(
    "OK: silent recognition triggered timeout fallback after",
    PUNJABI_SPEECH_LISTEN_TIMEOUT_MS,
    "ms"
  );
}

void main();
