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

export type MicrophoneFailureType =
  | "permission_denied"
  | "no_device"
  | "device_busy"
  | "unsupported"
  | "insecure_context"
  | "recording_failed"
  | "unknown";

/** Short machine label for logging a recorder failure. Never shown to students. */
export function microphoneFailureType(error: unknown): MicrophoneFailureType {
  if (typeof window !== "undefined" && window.isSecureContext === false) return "insecure_context";
  if (isMicrophoneBlockedError(error)) return "permission_denied";
  if (!error || typeof error !== "object") return "unknown";
  const name = "name" in error ? String(error.name) : "";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return "no_device";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return "device_busy";
  }
  if (name === "NotSupportedError" || name === "TypeError") return "unsupported";
  return "unknown";
}

export const MICROPHONE_BUSY_FAILURE: MicrophoneFailure = {
  kind: "message",
  message:
    "Your microphone is being used by another app. Close other apps or calls using it, then tap again.",
};

export const MICROPHONE_NOTHING_CAPTURED_FAILURE: MicrophoneFailure = {
  kind: "message",
  message: "No audio was captured. Check your microphone isn't muted, then try again.",
};
