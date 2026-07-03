/** BCP-47 tags to try for Punjabi speech recognition (most specific first). */
export const PUNJABI_SPEECH_LANG_TAGS = ["pa-IN", "pa-Guru-IN", "pa"] as const;

/** Primary tag — ISO 639-1 `pa` + India region. Chrome may fall back to English if unsupported. */
export const PUNJABI_SPEECH_LANG = PUNJABI_SPEECH_LANG_TAGS[0];

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
  "Speak It uses your browser's microphone and speech recognition. It works best in Chrome or Edge on desktop and Android — Safari and Firefox don't support this yet.";
