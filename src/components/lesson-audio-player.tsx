"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  saveLessonProgress,
} from "@/lib/progress/lesson-progress";
import { learningProductForLesson } from "@/lib/learning/learning-product";
import { recordStreakActivity } from "@/lib/progress/streak";

const SAVE_INTERVAL_MS = 10_000;
const COMPLETION_THRESHOLD = 0.9;

type LessonAudioPlayerProps = {
  lessonId: string;
  audioUrl: string;
  initialLastPosition?: number;
  initialCompleted?: boolean;
};

export function LessonAudioPlayer({
  lessonId,
  audioUrl,
  initialLastPosition = 0,
  initialCompleted = false,
}: LessonAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const userIdRef = useRef<string | null>(null);
  const lastSaveAtRef = useRef(0);
  const maxPositionRef = useRef(initialLastPosition);
  const completedRef = useRef(initialCompleted);
  const resumeAppliedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  const persistProgress = useCallback(
    async (currentTime: number, duration: number, force = false) => {
      const userId = userIdRef.current;
      if (!userId) return;

      const position = Math.floor(currentTime);
      maxPositionRef.current = Math.max(maxPositionRef.current, position);

      const listenedEnough =
        duration > 0 && currentTime / duration >= COMPLETION_THRESHOLD;
      const shouldComplete = completedRef.current || listenedEnough;

      const now = Date.now();
      if (!force && now - lastSaveAtRef.current < SAVE_INTERVAL_MS && !shouldComplete) {
        return;
      }

      lastSaveAtRef.current = now;

      const supabase = createClient();
      const wasCompleted = completedRef.current;

      const lessonBonus = await saveLessonProgress(supabase, userId, {
        lessonId,
        lastPosition: position,
        secondsListened: maxPositionRef.current,
        completed: shouldComplete,
      });

      if (lessonBonus > 0) {
      }

      if (shouldComplete && !wasCompleted) {
        completedRef.current = true;
        const product = await learningProductForLesson(supabase, lessonId);
        if (product === "punjabi") {
          await recordStreakActivity(supabase, userId);
        }
      }
    },
    [lessonId]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || resumeAppliedRef.current || initialLastPosition <= 0) return;

    const applyResume = () => {
      if (resumeAppliedRef.current) return;
      if (audio.duration && initialLastPosition < audio.duration - 1) {
        audio.currentTime = initialLastPosition;
      }
      resumeAppliedRef.current = true;
    };

    if (audio.readyState >= 1) {
      applyResume();
    } else {
      audio.addEventListener("loadedmetadata", applyResume);
      return () => audio.removeEventListener("loadedmetadata", applyResume);
    }
  }, [audioUrl, initialLastPosition]);

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    void persistProgress(audio.currentTime, audio.duration);
  }

  function handlePause() {
    const audio = audioRef.current;
    if (!audio) return;
    void persistProgress(audio.currentTime, audio.duration, true);
  }

  function handleEnded() {
    const audio = audioRef.current;
    if (!audio) return;
    void persistProgress(audio.duration, audio.duration, true);
  }

  return (
    <audio
      ref={audioRef}
      controls
      preload="metadata"
      className="w-full"
      src={audioUrl}
      onTimeUpdate={handleTimeUpdate}
      onPause={handlePause}
      onEnded={handleEnded}
    >
      Your browser does not support audio playback.
    </audio>
  );
}
