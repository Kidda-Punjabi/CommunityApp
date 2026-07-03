/** BCP-47 tags to try for Punjabi speech recognition (most specific first). */
export const PUNJABI_SPEECH_LANG_TAGS = ["pa-IN", "pa-Guru-IN", "pa"] as const;

/** Primary tag — ISO 639-1 `pa` + India region. Chrome may fall back to English if unsupported. */
export const PUNJABI_SPEECH_LANG = PUNJABI_SPEECH_LANG_TAGS[0];

/** How long to wait for speech activity before assuming silent failure (e.g. Safari + pa-IN). */
export const PUNJABI_SPEECH_LISTEN_TIMEOUT_MS = 5000;

export type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
};

export type SpeechRecognitionResultEvent = {
  results: SpeechRecognitionResultList;
};

export type SpeechRecognitionErrorEvent = {
  error: string;
  message?: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export function createPunjabiSpeechRecognition(): SpeechRecognitionInstance | null {
  const Ctor = getSpeechRecognitionConstructor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = PUNJABI_SPEECH_LANG;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

export const SPEECH_UNSUPPORTED_MESSAGE =
  "Speak It needs a browser with speech recognition (Firefox doesn't include it). On Safari you can start a session, but Punjabi input often fails silently — Chrome or Edge on desktop or Android works best.";

export const SPEECH_TIMEOUT_MESSAGE =
  "We couldn't detect your microphone for Punjabi voice input on this browser. Try Chrome on desktop or Android for the best experience.";

export const SPEECH_NOT_ALLOWED_MESSAGE =
  "Microphone access is blocked — check your browser's site settings.";

export const SPEECH_NO_SPEECH_MESSAGE =
  "No speech detected — tap record and try again.";

export const SPEECH_AUDIO_CAPTURE_MESSAGE =
  "We couldn't access your microphone — check that no other app is using it.";

export const SPEECH_NETWORK_MESSAGE =
  "Speech recognition needs a network connection in this browser — check your connection and try again.";

export const SPEECH_GENERIC_ERROR_MESSAGE = "Couldn't hear you — try again.";

export const SPEECH_EMPTY_TRANSCRIPT_MESSAGE =
  "We didn't catch that — try speaking a little louder.";

export const SPEECH_START_FAILED_MESSAGE = "Couldn't start listening — try again.";

export type SpeechFailurePath =
  | "unsupported_browser"
  | "start_exception"
  | "timeout"
  | "error_not_allowed"
  | "error_no_speech"
  | "error_audio_capture"
  | "error_network"
  | "error_other"
  | "empty_transcript";

export function logSpeechFailure(path: SpeechFailurePath, detail?: string) {
  console.info("[Speak It] speech recognition:", path, detail ?? "");
}

export function messageForSpeechError(errorCode: string): {
  message: string;
  path: SpeechFailurePath;
} {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return { message: SPEECH_NOT_ALLOWED_MESSAGE, path: "error_not_allowed" };
    case "no-speech":
      return { message: SPEECH_NO_SPEECH_MESSAGE, path: "error_no_speech" };
    case "audio-capture":
      return { message: SPEECH_AUDIO_CAPTURE_MESSAGE, path: "error_audio_capture" };
    case "network":
      return { message: SPEECH_NETWORK_MESSAGE, path: "error_network" };
    default:
      return { message: SPEECH_GENERIC_ERROR_MESSAGE, path: "error_other" };
  }
}
