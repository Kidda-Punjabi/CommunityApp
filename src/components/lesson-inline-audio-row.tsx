"use client";

import { LessonAudioPlayer } from "@/components/lesson-audio-player";

type LessonInlineAudioRowProps = {
  lessonId: string;
  audioUrl: string;
  initialLastPosition?: number;
  initialCompleted?: boolean;
};

export function LessonInlineAudioRow({
  lessonId,
  audioUrl,
  initialLastPosition = 0,
  initialCompleted = false,
}: LessonInlineAudioRowProps) {
  return (
    <div className="border-b border-zinc-100 py-3 last:border-b-0">
      <div className="mb-2">
        <p className="text-sm font-medium text-zinc-900">Lesson audio</p>
        <p className="mt-0.5 text-sm text-zinc-500">Listen to the Punjabi narration</p>
      </div>
      <LessonAudioPlayer
        lessonId={lessonId}
        audioUrl={audioUrl}
        initialLastPosition={initialLastPosition}
        initialCompleted={initialCompleted}
      />
    </div>
  );
}
