import {
  createPunjabiSpeechRecognition,
  logSpeechFailure,
  messageForSpeechError,
  PUNJABI_SPEECH_LISTEN_TIMEOUT_MS,
  SPEECH_EMPTY_TRANSCRIPT_MESSAGE,
  SPEECH_START_FAILED_MESSAGE,
  SPEECH_TIMEOUT_MESSAGE,
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
  const recognition = createPunjabiSpeechRecognition();
  if (!recognition) {
    logSpeechFailure("unsupported_browser");
    options.onError(SPEECH_UNSUPPORTED_MESSAGE);
    return { stop: () => {} };
  }

  return bindRecognitionSession(recognition, options);
}

function bindRecognitionSession(
  recognition: SpeechRecognitionInstance,
  options: PunjabiRecognitionSessionOptions
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
      logSpeechFailure("empty_transcript");
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

    const { message, path } = messageForSpeechError(event.error);
    logSpeechFailure(path, event.message ?? event.error);
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

    logSpeechFailure("timeout");
    options.onError(SPEECH_TIMEOUT_MESSAGE);
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
    logSpeechFailure("start_exception", error instanceof Error ? error.message : String(error));
    options.onError(SPEECH_START_FAILED_MESSAGE);
    finish(false);
  }

  return { stop };
}
