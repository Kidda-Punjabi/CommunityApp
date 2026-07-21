"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SPEECH_THRESHOLD = 0.018;
const SILENCE_END_MS = 750;
const MIN_UTTERANCE_MS = 400;
const MAX_UTTERANCE_MS = 20_000;
const ANALYSIS_INTERVAL_MS = 60;

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function rmsFromTimeDomain(data: Uint8Array): number {
  let sum = 0;
  for (let index = 0; index < data.length; index += 1) {
    const normalized = (data[index] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / data.length);
}

export type ContinuousVadUtterance = {
  blob: Blob;
  durationSeconds: number;
};

type UseContinuousVadOptions = {
  enabled: boolean;
  onUtterance: (utterance: ContinuousVadUtterance) => void | Promise<void>;
  onError?: (message: string) => void;
};

export function useContinuousVad({ enabled, onUtterance, onError }: UseContinuousVadOptions) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const monitorTimerRef = useRef<number | null>(null);
  const speechStartedAtRef = useRef<number | null>(null);
  const lastSpeechAtRef = useRef<number | null>(null);
  const recordingRef = useRef(false);
  const processingRef = useRef(false);
  const listeningRef = useRef(false);
  const startingRef = useRef(false);
  const onUtteranceRef = useRef(onUtterance);
  const onErrorRef = useRef(onError);
  const startListeningRef = useRef<() => Promise<void>>(async () => {});
  const stopListeningRef = useRef<() => void>(() => {});

  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  const stopMonitor = useCallback(() => {
    if (monitorTimerRef.current) {
      window.clearInterval(monitorTimerRef.current);
      monitorTimerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    stopMonitor();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    recordingRef.current = false;
    speechStartedAtRef.current = null;
    lastSpeechAtRef.current = null;
    listeningRef.current = false;
    startingRef.current = false;
    setListening(false);
  }, [stopMonitor]);

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recordingRef.current || processingRef.current) return;

    const mimeType = pickRecorderMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorderRef.current = recorder;
    recordingRef.current = true;
    speechStartedAtRef.current = Date.now();
    lastSpeechAtRef.current = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      recordingRef.current = false;
      const startedAt = speechStartedAtRef.current ?? Date.now();
      const durationMs = Math.max(Date.now() - startedAt, MIN_UTTERANCE_MS);
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      chunksRef.current = [];
      speechStartedAtRef.current = null;
      lastSpeechAtRef.current = null;

      if (blob.size === 0 || durationMs < MIN_UTTERANCE_MS) {
        return;
      }

      setProcessing(true);
      void Promise.resolve(
        onUtteranceRef.current({
          blob,
          durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
        })
      )
        .catch((error) => {
          onErrorRef.current?.(
            error instanceof Error ? error.message : "Failed to process speech."
          );
        })
        .finally(() => {
          setProcessing(false);
        });
    };

    recorder.start();
  }, []);

  const monitorLevels = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || processingRef.current) return;

    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    const level = rmsFromTimeDomain(buffer);
    const now = Date.now();
    const speaking = level >= SPEECH_THRESHOLD;

    if (speaking) {
      lastSpeechAtRef.current = now;
      if (!recordingRef.current) {
        startRecorder();
      }
      return;
    }

    if (!recordingRef.current || !lastSpeechAtRef.current || !speechStartedAtRef.current) {
      return;
    }

    const utteranceMs = now - speechStartedAtRef.current;
    const silenceMs = now - lastSpeechAtRef.current;

    if (utteranceMs >= MAX_UTTERANCE_MS || silenceMs >= SILENCE_END_MS) {
      finishRecording();
    }
  }, [finishRecording, startRecorder]);

  const startListening = useCallback(async () => {
    // Guard with refs — never put `listening` in this callback's deps, or the
    // enable effect will tear down and restart the mic in a loop.
    if (listeningRef.current || startingRef.current || processingRef.current) return;

    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      listeningRef.current = true;
      setListening(true);
      stopMonitor();
      monitorTimerRef.current = window.setInterval(monitorLevels, ANALYSIS_INTERVAL_MS);
    } catch {
      stopStream();
      onErrorRef.current?.("Microphone access is required for Live Translate.");
    } finally {
      startingRef.current = false;
    }
  }, [monitorLevels, stopMonitor, stopStream]);

  const stopListening = useCallback(() => {
    if (recordingRef.current) {
      finishRecording();
    }
    stopStream();
  }, [finishRecording, stopStream]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  useEffect(() => {
    if (!enabled) {
      stopListeningRef.current();
      return;
    }

    void startListeningRef.current();
    return () => {
      stopListeningRef.current();
    };
  }, [enabled]);

  return {
    listening,
    processing,
    stopListening,
  };
}
