export type MicrophoneFailure =
  | {
      kind: "blocked";
      title: string;
      iphone: string;
      chrome: string;
    }
  | { kind: "message"; message: string };

export const MICROPHONE_BLOCKED_FAILURE: MicrophoneFailure = {
  kind: "blocked",
  title:
    "Microphone access is blocked. Enable it in your browser settings for kidda.app, then tap again.",
  iphone: "iPhone: Settings → Safari → Microphone → Allow.",
  chrome: "Chrome: lock icon in the address bar → Site settings → Microphone → Allow.",
};

const MICROPHONE_UNAVAILABLE_MESSAGE =
  "This browser can't record audio. Try Safari or Chrome, then tap again.";

const MICROPHONE_RETRY_MESSAGE = "We couldn't start the microphone. Tap again to retry.";

export function isMicrophoneBlockedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  );
}

/** Map a getUserMedia / MediaRecorder failure to student copy. Never returns error.message. */
export function messageForMicrophoneFailure(error: unknown): MicrophoneFailure {
  if (isMicrophoneBlockedError(error)) return MICROPHONE_BLOCKED_FAILURE;
  if (!error || typeof error !== "object") {
    return { kind: "message", message: MICROPHONE_RETRY_MESSAGE };
  }
  const name = "name" in error ? String(error.name) : "";
  if (name === "NotFoundError" || name === "NotSupportedError" || name === "TypeError") {
    return { kind: "message", message: MICROPHONE_UNAVAILABLE_MESSAGE };
  }
  return { kind: "message", message: MICROPHONE_RETRY_MESSAGE };
}

export function microphoneUnavailableFailure(): MicrophoneFailure {
  return { kind: "message", message: MICROPHONE_UNAVAILABLE_MESSAGE };
}

/** Drop database, vendor, and browser exception text before it reaches the student. */
export function safePracticeMessage(message: string | undefined, fallback: string): string {
  const trimmed = message?.trim() ?? "";
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("permission") ||
    lower.includes("notallowed") ||
    lower.includes("not-allowed") ||
    lower.includes("pgrst") ||
    lower.includes("postgres") ||
    lower.includes("elevenlabs") ||
    lower.includes("jwt") ||
    lower.includes("stack") ||
    trimmed.length > 180
  ) {
    return fallback;
  }
  return trimmed;
}
