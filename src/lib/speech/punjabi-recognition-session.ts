import {
  createPunjabiSpeechRecognition,
  isRetryableSpeechError,
  logSpeechFailure,
  messageForSpeechError,
  nextPunjabiSpeechLang,
  PUNJABI_SPEECH_AFTER_MIC_TIMEOUT_MS,
  PUNJABI_SPEECH_LANG,
  PUNJABI_SPEECH_LISTEN_TIMEOUT_MS,
  PUNJABI_SPEECH_RETRY_DELAY_MS,
  speechPunjabiUnavailableMessage,
  SPEECH_EMPTY_TRANSCRIPT_MESSAGE,
  SPEECH_START_FAILED_MESSAGE,
  SPEECH_UNSUPPORTED_MESSAGE,
  type SpeechRecognitionInstance,
  type SpeechRecognitionResultEvent,
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
  let retryTimerId: ReturnType<typeof setTimeout> | null = null;

  const clearRetryTimer = () => {
    if (retryTimerId !== null) {
      clearTimeout(retryTimerId);
      retryTimerId = null;
    }
  };

  const startAttempt = (lang: string): void => {
    const recognition = createPunjabiSpeechRecognition(lang);
    if (!recognition) {
      logSpeechFailure("unsupported_browser");
      options.onError(SPEECH_UNSUPPORTED_MESSAGE);
      return;
    }

    activeStop = bindRecognitionSession(recognition, lang, {
      ...options,
      onRetry: (nextLang) => {
        clearRetryTimer();
        options.onListeningChange(false);
        retryTimerId = setTimeout(() => {
          retryTimerId = null;
          startAttempt(nextLang);
        }, PUNJABI_SPEECH_RETRY_DELAY_MS);
      },
    }).stop;
  };

  startAttempt(PUNJABI_SPEECH_LANG);

  return {
    stop: () => {
      clearRetryTimer();
      activeStop?.();
      activeStop = null;
    },
  };
}

type BindOptions = PunjabiRecognitionSessionOptions & {
  onRetry: (lang: string) => void;
};

function transcriptFromResult(event: SpeechRecognitionResultEvent): string {
  const results = event.results;
  let transcript = "";

  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    const isFinal =
      typeof result.isFinal === "boolean" ? result.isFinal : index === results.length - 1;
    if (!isFinal) continue;
    transcript = result[0]?.transcript ?? "";
    if (transcript.trim()) break;
  }

  if (transcript.trim()) return transcript;

  return results[0]?.[0]?.transcript ?? "";
}

function bindRecognitionSession(
  recognition: SpeechRecognitionInstance,
  lang: string,
  options: BindOptions
): PunjabiRecognitionSession {
  let finished = false;
  let heardSpeech = false;
  let micOpened = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearListenTimeout = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const finish = (listening: boolean) => {
    if (finished) return;
    finished = true;
    clearListenTimeout();
    options.onListeningChange(listening);
  };

  const markSpeechActivity = () => {
    heardSpeech = true;
    clearListenTimeout();
  };

  const scheduleTimeout = (ms: number, onTimeout: () => void) => {
    clearListenTimeout();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      onTimeout();
    }, ms);
  };

  const failWithTimeout = () => {
    if (heardSpeech || finished) return;

    const nextLang = nextPunjabiSpeechLang(lang);
    if (nextLang) {
      logSpeechFailure("timeout", `lang=${lang} retry=${nextLang} mic=${micOpened}`);
      finished = true;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      options.onRetry(nextLang);
      return;
    }

    logSpeechFailure("timeout", `lang=${lang} mic=${micOpened}`);
    options.onError(speechPunjabiUnavailableMessage());
    finished = true;

    try {
      recognition.abort();
    } catch {
      // ignore
    }

    options.onListeningChange(false);
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

  recognition.onaudiostart = () => {
    micOpened = true;
    if (heardSpeech || finished) return;
    scheduleTimeout(PUNJABI_SPEECH_AFTER_MIC_TIMEOUT_MS, failWithTimeout);
  };

  recognition.onspeechstart = () => {
    markSpeechActivity();
  };

  recognition.onresult = (event) => {
    const transcript = transcriptFromResult(event);
    if (!transcript.trim()) return;

    markSpeechActivity();
    options.onTranscript(transcript);
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "aborted" || finished) return;

    clearListenTimeout();

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
    clearListenTimeout();
    if (!finished && !heardSpeech) {
      logSpeechFailure("empty_transcript", `lang=${lang} ended-without-result`);
      options.onError(SPEECH_EMPTY_TRANSCRIPT_MESSAGE);
      finished = true;
      options.onListeningChange(false);
      return;
    }
    if (!finished) {
      finished = true;
      options.onListeningChange(false);
    }
  };

  scheduleTimeout(PUNJABI_SPEECH_LISTEN_TIMEOUT_MS, failWithTimeout);

  try {
    recognition.start();
    options.onListeningChange(true);
  } catch (error) {
    clearListenTimeout();
    logSpeechFailure(
      "start_exception",
      `lang=${lang} ${error instanceof Error ? error.message : String(error)}`
    );
    options.onError(SPEECH_START_FAILED_MESSAGE);
    finish(false);
  }

  return { stop };
}
