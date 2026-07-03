import {
  createPunjabiSpeechRecognition,
  isRetryableSpeechError,
  logSpeechFailure,
  messageForSpeechError,
  nextPunjabiSpeechLang,
  PUNJABI_SPEECH_LANG,
  PUNJABI_SPEECH_LANG_TAGS,
  PUNJABI_SPEECH_LISTEN_TIMEOUT_MS,
  SPEECH_EMPTY_TRANSCRIPT_MESSAGE,
  SPEECH_PUNJABI_UNAVAILABLE_MESSAGE,
  SPEECH_START_FAILED_MESSAGE,
  SPEECH_UNSUPPORTED_MESSAGE,
  type SpeechRecognitionInstance,
} from "./speech-recognition";

export type PunjabiRecognitionSessionOptions = {
  onTranscript: (transcript: string) => void;
  onError: (message: string) => void;
  onListeningChange: (listening: boolean) => void;
};

export type PunjabiRecognitionSession = {
  stop: () => void;
};

export function startPunjabiRecognitionSession(
  options: PunjabiRecognitionSessionOptions
): PunjabiRecognitionSession {
  let activeStop: (() => void) | null = null;

  const startAttempt = (lang: string): void => {
    const recognition = createPunjabiSpeechRecognition(lang);
    if (!recognition) {
      logSpeechFailure("unsupported_browser");
      options.onError(SPEECH_UNSUPPORTED_MESSAGE);
      return;
    }

    activeStop = bindRecognitionSession(recognition, lang, {
      ...options,
      onRetry: (nextLang) => startAttempt(nextLang),
    }).stop;
  };

  startAttempt(PUNJABI_SPEECH_LANG);

  return {
    stop: () => {
      activeStop?.();
      activeStop = null;
    },
  };
}

type BindOptions = PunjabiRecognitionSessionOptions & {
  onRetry: (lang: string) => void;
};

function bindRecognitionSession(
  recognition: SpeechRecognitionInstance,
  lang: string,
  options: BindOptions
): PunjabiRecognitionSession {
  let finished = false;
  let heardActivity = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const finish = (listening: boolean) => {
    if (finished) return;
    finished = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    options.onListeningChange(listening);
  };

  const markActivity = () => {
    heardActivity = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const stop = () => {
    if (finished) return;
    try {
      recognition.abort();
    } catch {
      // ignore
    }
    finish(false);
  };

  recognition.onspeechstart = () => {
    markActivity();
  };

  recognition.onresult = (event) => {
    markActivity();

    const transcript = event.results[0]?.[0]?.transcript ?? "";
    if (!transcript.trim()) {
      logSpeechFailure("empty_transcript", `lang=${lang}`);
      options.onError(SPEECH_EMPTY_TRANSCRIPT_MESSAGE);
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      return;
    }

    options.onTranscript(transcript);
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "aborted" || finished) return;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const nextLang = nextPunjabiSpeechLang(lang);
    if (isRetryableSpeechError(event.error) && nextLang) {
      logSpeechFailure(
        event.error === "language-not-supported"
          ? "error_language_not_supported"
          : "error_network",
        `lang=${lang} retry=${nextLang} ${event.message ?? ""}`.trim()
      );
      finished = true;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      options.onRetry(nextLang);
      return;
    }

    const { message, path } = messageForSpeechError(event.error);
    logSpeechFailure(path, `lang=${lang} ${event.message ?? event.error}`.trim());
    options.onError(message);
    finished = true;
    options.onListeningChange(false);
  };

  recognition.onend = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (!finished) {
      finished = true;
      options.onListeningChange(false);
    }
  };

  timeoutId = setTimeout(() => {
    if (heardActivity || finished) return;

    const nextLang = nextPunjabiSpeechLang(lang);
    if (nextLang) {
      logSpeechFailure("timeout", `lang=${lang} retry=${nextLang}`);
      finished = true;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      options.onRetry(nextLang);
      return;
    }

    logSpeechFailure("timeout", `lang=${lang}`);
    options.onError(SPEECH_PUNJABI_UNAVAILABLE_MESSAGE);
    finished = true;

    try {
      recognition.abort();
    } catch {
      // ignore
    }

    options.onListeningChange(false);
  }, PUNJABI_SPEECH_LISTEN_TIMEOUT_MS);

  try {
    recognition.start();
    options.onListeningChange(true);
  } catch (error) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    logSpeechFailure(
      "start_exception",
      `lang=${lang} ${error instanceof Error ? error.message : String(error)}`
    );
    options.onError(SPEECH_START_FAILED_MESSAGE);
    finish(false);
  }

  return { stop };
}
